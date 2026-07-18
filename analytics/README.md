# NutriLife dbt Analytics Project

This directory contains the dbt (Data Build Tool) project for NutriLife. It is used to transform raw database tables into clean, analytical models, track data pipelines, and visualize data lineage.

## Setup with dbt Cloud

To use this project to view your pipeline and lineage graph in dbt Cloud, follow these steps:

1. **Create a dbt Cloud Account:** Sign up at [cloud.getdbt.com](https://cloud.getdbt.com/).
2. **Create a New Project:** Start a new project in dbt Cloud.
3. **Connect your Data Warehouse:** 
   * Choose your data warehouse (e.g., PostgreSQL, BigQuery, Snowflake).
   * *Note: If your raw data is in MySQL, you will need to either use a tool like Airbyte/Fivetran to load it into a supported warehouse, or use PostgreSQL as your main database, as dbt Cloud does not natively support MySQL.*
4. **Connect your Repository:**
   * Connect dbt Cloud to this GitHub repository.
   * **Crucial Step:** When configuring the repository in dbt Cloud, set the **Project Subdirectory** to `analytics`. This tells dbt Cloud where to find the `dbt_project.yml` file.
5. **Develop and Run:**
   * You can now use the dbt Cloud IDE to compile and run your models (`dbt run`, `dbt test`).
   * The Lineage Graph will automatically be generated in the IDE and your documentation based on the `{{ ref() }}` and `{{ source() }}` relationships defined in the `.sql` and `.yml` files.

## Project Structure

* `models/staging/`: Initial, light transformations of raw tables (e.g., `stg_users.sql`).
* `models/marts/core/`: Business-level, dimensional models (e.g., `dim_users.sql`).
