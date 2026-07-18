with stg_users as (
    select * from {{ ref('stg_users') }}
),

final as (
    select
        user_id,
        email,
        full_name,
        created_at,
        cast(created_at as date) as signup_date
    from stg_users
)

select * from final
