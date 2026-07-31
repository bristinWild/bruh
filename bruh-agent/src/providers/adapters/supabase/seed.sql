insert into public.historical_market_events (
        title,
        description,
        market_question,
        resolution_criteria,
        category,
        tags,
        outcome,
        resolved_at,
        source_name,
        source_url,
        credibility_score
    )
values (
        'Ethereum crossed $4,000 during the 2021 bull market',
        'Ethereum exceeded $4,000 after sustained institutional demand and broad crypto-market momentum.',
        'Will ETH trade above $4,000?',
        'Resolved YES if ETH/USD exceeded $4,000 before the deadline.',
        'crypto',
        array [
        'ethereum',
        'price',
        'crypto',
        'bull-market'
    ],
        'YES',
        '2021-05-10T00:00:00Z',
        'Historical market data',
        null,
        0.8
    ),
    (
        'Ethereum failed to reclaim $4,000 after the 2021 correction',
        'Ethereum recovered from its local low but did not trade above $4,000 during the selected window.',
        'Will ETH trade above $4,000?',
        'Resolved YES if ETH/USD exceeded $4,000 before the deadline.',
        'crypto',
        array [
        'ethereum',
        'price',
        'crypto',
        'correction'
    ],
        'NO',
        '2021-07-31T00:00:00Z',
        'Historical market data',
        null,
        0.75
    ),
    (
        'Federal Reserve kept rates unchanged after elevated inflation',
        'The Federal Reserve maintained the target range despite expectations of a possible cut.',
        'Will the Federal Reserve cut interest rates?',
        'Resolved YES if the target federal funds rate was reduced at the meeting.',
        'macro',
        array [
        'federal-reserve',
        'interest-rates',
        'inflation',
        'macro'
    ],
        'NO',
        '2024-06-12T00:00:00Z',
        'Federal Reserve',
        'https://www.federalreserve.gov/',
        1
    );