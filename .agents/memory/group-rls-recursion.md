---
name: Supabase group RLS infinite recursion
description: Why group_members / groups RLS policies caused "infinite recursion detected in policy" and the SECURITY DEFINER fix.
---

# Symptom
Creating a group (or any read touching `groups` / `group_members`) fails with: `infinite recursion detected in policy for relation "group_members"`.

# Cause
An RLS policy on `group_members` (or `groups`) that references `group_members` in its `USING` clause via a subquery. Postgres re-evaluates the policy when reading the subquery's own table → infinite recursion. Example of the broken pattern: `group_members_select USING (group_id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid()))`.

# Fix
Move the membership lookup into a `SECURITY DEFINER` SQL function (`is_group_member(gid)`, `is_group_admin(gid)`) with `SET search_path = public`. Because it runs as the function owner, it bypasses RLS on `group_members`, breaking the recursion. Policies then call the function: `USING (user_id = auth.uid() OR public.is_group_member(group_id))`.

**Why:** RLS policies cannot self-reference their own (or a mutually-referencing) table without recursing; SECURITY DEFINER is the standard Supabase escape hatch.

**How to apply:** Any RLS policy that must check membership/ownership across a join table should call a SECURITY DEFINER helper, never an inline subquery against the protected table. Apply DDL to the Supabase DB via the Management API (`POST https://api.supabase.com/v1/projects/<ref>/database/query`) with the user's `sbp_` PAT — the env DATABASE_URL/PG* point to an unrelated `helium` Postgres, NOT Supabase.
