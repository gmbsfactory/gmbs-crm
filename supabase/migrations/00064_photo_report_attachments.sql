-- Create the intervention_attachments table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.intervention_attachments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    intervention_id UUID NOT NULL REFERENCES public.interventions(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    filename TEXT NOT NULL,
    mime_type TEXT,
    size_bytes BIGINT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES auth.users(id),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add metadata column if it doesn't exist (for existing tables)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'intervention_attachments' 
        AND column_name = 'metadata'
    ) THEN
        ALTER TABLE public.intervention_attachments ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
    END IF;
END $$;

-- Add comments for documentation
COMMENT ON TABLE public.intervention_attachments IS 'Stores metadata and links to files in Storage for interventions (Photo-to-Report)';
COMMENT ON COLUMN public.intervention_attachments.metadata IS 'Stores additional info like comment, tags, geoloc, etc.';

-- Enable Row Level Security
ALTER TABLE public.intervention_attachments ENABLE ROW LEVEL SECURITY;

-- Create policies
-- Allow read access to authenticated users
CREATE POLICY "Allow read access for authenticated users" ON public.intervention_attachments
    FOR SELECT
    TO authenticated
    USING (true);

-- Allow insert access to authenticated users
CREATE POLICY "Allow insert access for authenticated users" ON public.intervention_attachments
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = created_by);

-- Allow update access to authenticated users (e.g. for updating comments)
CREATE POLICY "Allow update access for authenticated users" ON public.intervention_attachments
    FOR UPDATE
    TO authenticated
    USING (true);

-- Allow delete access to authenticated users
CREATE POLICY "Allow delete access for authenticated users" ON public.intervention_attachments
    FOR DELETE
    TO authenticated
    USING (true);

-- Create index for faster lookups by intervention_id
CREATE INDEX IF NOT EXISTS idx_intervention_attachments_intervention_id ON public.intervention_attachments(intervention_id);

-- Create the update_updated_at_column function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at (drop first if exists to avoid conflicts)
DROP TRIGGER IF EXISTS update_intervention_attachments_updated_at ON public.intervention_attachments;
CREATE TRIGGER update_intervention_attachments_updated_at
    BEFORE UPDATE ON public.intervention_attachments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
