-- Fix: "infinite recursion detected in policy for relation group_members"
-- The old group_members/groups SELECT+UPDATE policies queried group_members
-- from within their own policy, which Postgres evaluates recursively.
-- Solution: SECURITY DEFINER helper functions that bypass RLS.

CREATE OR REPLACE FUNCTION public.is_group_member(gid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM group_members
    WHERE group_id = gid AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_group_admin(gid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM group_members
    WHERE group_id = gid AND user_id = auth.uid() AND role = 'admin'
  );
$$;

DROP POLICY IF EXISTS "groups_select" ON groups;
CREATE POLICY "groups_select" ON groups FOR SELECT USING (
  created_by = auth.uid() OR public.is_group_member(id)
);

DROP POLICY IF EXISTS "groups_update" ON groups;
CREATE POLICY "groups_update" ON groups FOR UPDATE USING (
  created_by = auth.uid() OR public.is_group_admin(id)
);

DROP POLICY IF EXISTS "group_members_select" ON group_members;
CREATE POLICY "group_members_select" ON group_members FOR SELECT USING (
  user_id = auth.uid() OR public.is_group_member(group_id)
);
