-- Create admin_connectors table for Composio MCP integration
CREATE TABLE IF NOT EXISTS public.admin_connectors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    toolkit_name TEXT NOT NULL,
    composio_entity_id TEXT NOT NULL, -- same as admin's Supabase UUID
    is_enabled BOOLEAN DEFAULT true,
    connected_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(admin_user_id, toolkit_name)
);

-- Enable RLS
ALTER TABLE public.admin_connectors ENABLE ROW LEVEL SECURITY;

-- Add policy: admins can read/write their own rows only
CREATE POLICY "Admins can manage their own connectors" 
ON public.admin_connectors
FOR ALL 
TO authenticated
USING (auth.uid() = admin_user_id)
WITH CHECK (auth.uid() = admin_user_id);

-- Add comments for documentation
COMMENT ON TABLE public.admin_connectors IS 'Stores connections between admins and Composio toolkits (Gmail, Slack, etc.).';
COMMENT ON COLUMN public.admin_connectors.composio_entity_id IS 'Secondary ID used for Composio entity scoping, typically matches admin_user_id.';
