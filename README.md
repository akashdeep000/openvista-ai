# openvista-ai

This repository contains the source code for openvista-ai.

## Setup

To set up the project locally, follow these steps:

1.  **Clone the repository:**

    ```sh
    git clone https://github.com/your-org/openvista-ai.git # Replace with the actual repo URL
    cd openvista-ai
    ```

2.  **Install dependencies:**

    This project uses pnpm. Ensure you have pnpm installed (`npm install -g pnpm`).

    ```sh
    pnpm install
    ```

3.  **Environment Configuration:**

    Copy the example environment file and update it with your configuration.

    ```sh
    cp .env.example .env
    # Edit the .env file with your database connection string and other settings.
    ```

    Available Environment Variables:

    | Variable      | Description                     |
    |---------------|---------------------------------|
    | `DATABASE_URL` | Connection string for the database |

4.  **Install GIS Dependencies:**

    The GIS loader requires `ogr2ogr` (part of GDAL) and `osm2pgsql`. Install them using your system's package manager:

    **Debian/Ubuntu:**
    ```sh
    sudo apt update
    sudo apt install gdal-bin osm2pgsql
    ```

    **macOS (using Homebrew):**
    ```sh
    brew update
    brew install gdal osm2pgsql
    ```

    For other operating systems, please refer to the official documentation for [GDAL](https://gdal.org/download.html) and [osm2pgsql](https://osm2pgsql.org/doc/install.html).

<!-- 5.  **Database Setup:**

    Generate and run database migrations.

    ```sh
    pnpm run db:generate
    pnpm run db:migrate
    ``` -->

5.  **Start Drizzle Studio:**

    To view and manage the database, run the following command:

    ```sh
    pnpm run dev
    ```

## GIS Data Setup

This project includes a tool for downloading and importing geographical data.

1.  **Download GIS data:**

    ```sh
    pnpm run gis-loader download
    ```

2.  **Import GIS data into the database:**

    ```sh
    pnpm run gis-loader import
    ```

After completing these steps, the GIS data should be set up in your local database.

## Contributing

(Add contributing guidelines here)

## License

(Add license information here)