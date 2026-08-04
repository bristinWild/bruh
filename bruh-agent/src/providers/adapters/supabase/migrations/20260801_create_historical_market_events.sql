create table if not exists public.historical_market_events (
    id uuid primary key default gen_random_uuid(),

    title text not null,

    description text,

    market_question text,

    resolution_criteria text,

    category text,

    tags text[] not null default '{}',

    outcome text not null
        check (
            outcome in (
                'YES',
                'NO',
                'resolved_yes',
                'resolved_no'
            )
        ),

    resolved_at timestamptz,

    source_name text,

    source_url text,

    credibility_score double precision
        check (
            credibility_score is null
            or (
                credibility_score >= 0
                and credibility_score <= 1
            )
        ),

    metadata jsonb not null default '{}'::jsonb,

    created_at timestamptz not null default now()
);

create index if not exists
    historical_market_events_category_idx
on public.historical_market_events (
    category
);

create index if not exists
    historical_market_events_resolved_at_idx
on public.historical_market_events (
    resolved_at desc
);

create index if not exists
    historical_market_events_tags_idx
on public.historical_market_events
using gin (
    tags
);