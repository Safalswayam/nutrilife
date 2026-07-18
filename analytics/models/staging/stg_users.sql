with source as (
    select * from {{ source('nutrilife_db', 'users') }}
),

renamed as (
    select
        id as user_id,
        email,
        name as full_name,
        created_at,
        updated_at
        -- Add other relevant columns here
    from source
)

select * from renamed
