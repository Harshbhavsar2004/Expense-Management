-- Create dashboards table to store visual dashboard specifications
CREATE TABLE IF NOT EXISTS public.dashboards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    spec JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.dashboards ENABLE ROW LEVEL SECURITY;

-- Allow service role (and thus our agent) full access
CREATE POLICY "Allow service_role full access" ON public.dashboards
    FOR ALL USING (auth.role() = 'service_role');

-- Allow anon/authenticated users to read dashboards by ID (for the full-page view)
CREATE POLICY "Allow public read access" ON public.dashboards
    FOR SELECT USING (true);
