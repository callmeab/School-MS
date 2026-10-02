import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface CreateTeacherPayload {
  action: "create_teacher";
  email: string;
  password: string;
  full_name: string;
  phone?: string | null;
  employee_code: string;
  qualification?: string | null;
  joining_date: string;
}

interface ResetPasswordPayload {
  action: "reset_password";
  user_id: string;
  password: string;
}

interface SetActivePayload {
  action: "set_active";
  user_id: string;
  is_active: boolean;
}

type RequestPayload = CreateTeacherPayload | ResetPasswordPayload | SetActivePayload;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

serve(async (req: Request) => {
  // 1. Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed. Use POST." }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // 2. Extract Authorization Header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Missing or invalid authorization header." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return new Response(JSON.stringify({ error: "Server configuration error: missing Supabase environment keys." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Verify Caller Authentication with Anon Client + Caller JWT
    const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    const { data: { user: callerUser }, error: authError } = await callerClient.auth.getUser();
    if (authError || !callerUser) {
      return new Response(JSON.stringify({ error: "Unauthorized: Invalid or expired session." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Verify Caller is an ACTIVE ADMIN
    const { data: callerProfile, error: profileCheckError } = await callerClient
      .from("profiles")
      .select("id, role, is_active")
      .eq("id", callerUser.id)
      .single();

    if (profileCheckError || !callerProfile || callerProfile.role !== "admin" || !callerProfile.is_active) {
      return new Response(JSON.stringify({ error: "Forbidden: Only active administrators can perform this action." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 5. Initialize Service Role Client for Privileged Execution
    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // 6. Parse and Validate Request Body
    const body: RequestPayload = await req.json();

    switch (body.action) {
      // ======================================================================
      // ACTION: CREATE TEACHER
      // ======================================================================
      case "create_teacher": {
        const { email, password, full_name, phone, employee_code, qualification, joining_date } = body;

        // Email validation
        if (!email || !EMAIL_REGEX.test(email.trim())) {
          return new Response(JSON.stringify({ error: "A valid email address is required." }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Password validation (min 8 characters)
        if (!password || password.length < 8) {
          return new Response(JSON.stringify({ error: "Password must be at least 8 characters long." }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Full name validation
        if (!full_name || full_name.trim().length === 0 || full_name.trim().length > 100) {
          return new Response(JSON.stringify({ error: "Full name is required (maximum 100 characters)." }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Employee code validation
        if (!employee_code || employee_code.trim().length === 0 || employee_code.trim().length > 30) {
          return new Response(JSON.stringify({ error: "A unique employee code is required (maximum 30 characters)." }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const trimmedEmail = email.trim().toLowerCase();
        const trimmedName = full_name.trim();
        const trimmedPhone = phone ? phone.trim() : null;
        const empCode = employee_code.trim().toUpperCase();
        const trimmedQual = qualification ? qualification.trim() : null;
        const joiningDate = joining_date ? joining_date.trim() : new Date().toISOString().split("T")[0];

        let newUserId: string | null = null;

        try {
          // Step 1: Create Supabase Auth User with auto-confirmed email
          const { data: authResult, error: createAuthError } = await adminClient.auth.admin.createUser({
            email: trimmedEmail,
            password: password,
            email_confirm: true,
            user_metadata: {
              full_name: trimmedName,
              phone: trimmedPhone,
            },
          });

          if (createAuthError || !authResult.user) {
            const authMsg = createAuthError?.message?.toLowerCase() ?? "";
            if (authMsg.includes("already registered") || authMsg.includes("already exists")) {
              throw new Error("This email address is already registered.");
            }
            throw new Error(createAuthError?.message || "Failed to create user authentication record.");
          }

          newUserId = authResult.user.id;

          // Step 2: Update Profile (DB trigger set role to 'student' by default; update to 'teacher')
          const { error: profileUpdateError } = await adminClient
            .from("profiles")
            .update({
              role: "teacher",
              full_name: trimmedName,
              phone: trimmedPhone,
              is_active: true,
            })
            .eq("id", newUserId);

          if (profileUpdateError) throw profileUpdateError;

          // Step 3: Insert into teachers table
          const { data: teacherRow, error: teacherInsertError } = await adminClient
            .from("teachers")
            .insert({
              profile_id: newUserId,
              employee_code: empCode,
              qualification: trimmedQual,
              joining_date: joiningDate,
            })
            .select("id, profile_id, employee_code, qualification, joining_date, created_at")
            .single();

          if (teacherInsertError) throw teacherInsertError;

          return new Response(
            JSON.stringify({
              data: {
                id: teacherRow.id,
                profile_id: newUserId,
                employee_code: teacherRow.employee_code,
                qualification: teacherRow.qualification,
                joining_date: teacherRow.joining_date,
                created_at: teacherRow.created_at,
                full_name: trimmedName,
                phone: trimmedPhone,
                is_active: true,
                email: trimmedEmail,
              },
              message: `Teacher "${trimmedName}" account created successfully.`,
            }),
            {
              status: 201,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        } catch (dbErr: any) {
          // ROLLBACK: Delete auth user if already created to prevent orphaned accounts
          if (newUserId) {
            try {
              await adminClient.auth.admin.deleteUser(newUserId);
            } catch (rollbackErr) {
              console.error("Rollback error deleting user:", rollbackErr);
            }
          }

          let friendlyMsg = dbErr?.message || "Failed to create teacher account.";
          const code = dbErr?.code || "";

          if (code === "23505" || friendlyMsg.includes("employee_code")) {
            friendlyMsg = "Employee code already exists. Please choose a different code.";
          } else if (friendlyMsg.includes("email")) {
            friendlyMsg = "This email is already registered.";
          }

          return new Response(JSON.stringify({ error: friendlyMsg }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      // ======================================================================
      // ACTION: RESET PASSWORD (TEACHERS ONLY)
      // ======================================================================
      case "reset_password": {
        const { user_id, password } = body;

        if (!user_id || !UUID_REGEX.test(user_id)) {
          return new Response(JSON.stringify({ error: "A valid user ID is required." }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if (!password || password.length < 8) {
          return new Response(JSON.stringify({ error: "Password must be at least 8 characters long." }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Verify target account exists and role is strictly 'teacher'
        const { data: targetProfile, error: targetFindError } = await adminClient
          .from("profiles")
          .select("id, role, full_name")
          .eq("id", user_id)
          .single();

        if (targetFindError || !targetProfile) {
          return new Response(JSON.stringify({ error: "Teacher account not found." }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if (targetProfile.role !== "teacher") {
          return new Response(JSON.stringify({ error: "Cannot reset passwords for non-teacher accounts via this function." }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { error: resetError } = await adminClient.auth.admin.updateUserById(user_id, {
          password: password,
        });

        if (resetError) {
          throw resetError;
        }

        return new Response(
          JSON.stringify({ message: `Password for "${targetProfile.full_name}" has been successfully updated.` }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // ======================================================================
      // ACTION: SET ACTIVE STATUS (TEACHERS ONLY)
      // ======================================================================
      case "set_active": {
        const { user_id, is_active } = body;

        if (!user_id || !UUID_REGEX.test(user_id)) {
          return new Response(JSON.stringify({ error: "A valid user ID is required." }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if (typeof is_active !== "boolean") {
          return new Response(JSON.stringify({ error: "Invalid status value. Boolean required." }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Admin must not deactivate their own account
        if (user_id === callerUser.id) {
          return new Response(JSON.stringify({ error: "You cannot deactivate your own administrator account." }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Check target user - must be role 'teacher'
        const { data: targetProfile, error: targetFindError } = await adminClient
          .from("profiles")
          .select("id, role, full_name")
          .eq("id", user_id)
          .single();

        if (targetFindError || !targetProfile) {
          return new Response(JSON.stringify({ error: "Teacher account not found." }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if (targetProfile.role !== "teacher") {
          return new Response(JSON.stringify({ error: "Cannot modify active status for non-teacher accounts via this function." }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { error: updateError } = await adminClient
          .from("profiles")
          .update({ is_active })
          .eq("id", user_id);

        if (updateError) {
          throw updateError;
        }

        const actionWord = is_active ? "activated" : "deactivated";
        return new Response(
          JSON.stringify({
            message: `Account for "${targetProfile.full_name}" has been ${actionWord}.`,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      default:
        return new Response(JSON.stringify({ error: "Unknown action specified." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (globalErr: any) {
    console.error("admin-users Edge Function Error:", globalErr);
    return new Response(
      JSON.stringify({ error: globalErr?.message || "An unexpected error occurred. Please try again." }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
