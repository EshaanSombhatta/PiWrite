-- Enable pgvector extension
create extension if not exists vector;

-- Profiles Table
create table public.profiles (
  id uuid references auth.users not null primary key,
  email text,
  full_name text,
  age integer,
  grade_level text, -- K, 1, 2, 3, 4, 5, 6
  interests text[],
  favorites jsonb, -- flexible storage for user favorites
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Writings Table (The top-level container for a piece of work)
create table public.writings (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references public.profiles(id) not null,
  title text default 'Untitled',
  genre text, -- e.g. narrative, persuasive
  current_stage text default 'prewriting', -- prewriting, drafting, revising, editing, publishing
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Writing Drafts (Snapshots of content)
create table public.writing_drafts (
  id uuid primary key default gen_random_uuid(),
  writing_id uuid references public.writings(id) not null,
  stage text not null,
  content text, -- The actual text content
  content_structure jsonb, -- For structured data if needed (e.g. outline)
  version integer default 1,
  created_at timestamptz default now()
);

-- Instructional Gaps & State
create table public.instructional_state (
  id uuid primary key default gen_random_uuid(),
  writing_id uuid references public.writings(id) not null,
  detected_gaps jsonb, -- List of identified gaps and their scores
  active_prompts jsonb, -- The current prompts being shown to the student
  retrieved_standard_ids uuid[], -- References to SOL table
  context_summary text, -- Agent memory summary
  created_at timestamptz default now()
);

-- SOL Standards Knowledge Base
create table public.sol_standards (
  id uuid primary key default gen_random_uuid(),
  content text not null, -- The text chunk
  metadata jsonb not null, -- { "grade": "3", "stage": "drafting", "skill": "usage" }
  embedding vector(384) -- MiniLM-L6-v2 dimension
);

-- Create a search function for RAG
create or replace function match_sol_standards (
  query_embedding vector(384),
  match_threshold float,
  match_count int,
  filter_metadata jsonb default '{}'
) returns table (
  id uuid,
  content text,
  metadata jsonb,
  similarity float
) language plpgsql stable as $$
begin
  return query (
    select
      sol_standards.id,
      sol_standards.content,
      sol_standards.metadata,
      1 - (sol_standards.embedding <=> query_embedding) as similarity
    from sol_standards
    where 1 - (sol_standards.embedding <=> query_embedding) > match_threshold
    and sol_standards.metadata @> filter_metadata
    order by sol_standards.embedding <=> query_embedding
    limit match_count
  );
end;
$$;
