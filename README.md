# OpenVista AI

This repository contains the source code for **OpenVista AI**, a platform that helps people find rural land in the U.S. using AI and GIS data.

---

## 🔧 Project Setup Guide (For Beginners)

Follow these steps to set up the project on your computer. No programming experience needed — just follow each step carefully.

---

## ✅ Prerequisites

Make sure the following tools are installed on your computer:

| Tool    | Description                                            | Install Guide                                                                                      |
| ------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| Git     | Version control tool used to download code from GitHub | [https://git-scm.com/downloads](https://git-scm.com/downloads)                                     |
| Node.js | JavaScript runtime needed to run the project           | [https://nodejs.org/en/download/](https://nodejs.org/en/download/)                                 |
| pnpm    | Package manager (like npm/yarn)                        | Run: `npm install -g pnpm` (after installing Node.js)                                              |
| Docker  | (Optional) Used to run the database locally            | [https://www.docker.com/products/docker-desktop/](https://www.docker.com/products/docker-desktop/) |

To check if these are installed, run in your terminal:

```sh
git --version
node -v
pnpm -v
docker -v   # (if using Docker)
```

---

### 1. 📁 Clone the Project Repository

You need to download the project files from GitHub:

Open a terminal (Command Prompt on Windows, Terminal app on macOS/Linux), then run:

```sh
git clone https://github.com/your-org/openvista-ai.git  # Replace with the correct GitHub link
cd openvista-ai
```

---

### 2. 📦 Install Dependencies

This project uses a tool called **pnpm** to manage the software it depends on.

#### Install `pnpm` (only once):

```sh
npm install -g pnpm
```

#### Then install the required packages:

```sh
pnpm install
```

---

### 3. 🛠 Set Up the Environment

The project uses a configuration file to connect to the database and other services.

#### Create your configuration file:

```sh
cp .env.example .env
```

#### Then open the `.env` file using any text editor (Notepad, VS Code, etc.) and update the values. At the very least, update:

```
DATABASE_URL=your_database_connection_string_here
```

> 💡 Ask a developer if you're unsure what your `DATABASE_URL` should be.

---

### 4. 🌍 Install GIS Tools (for mapping data)

To work with maps, you'll need two tools: `gdal` and `osm2pgsql`. Here's how to install them:

#### ✅ On Ubuntu/Debian:

```sh
sudo apt update
sudo apt install gdal-bin osm2pgsql
```

#### 🍏 On macOS (using Homebrew):

```sh
brew update
brew install gdal osm2pgsql
```

#### ❓ On Windows:

Download and install them from these official websites:

* [GDAL Downloads](https://gdal.org/download.html)
* [osm2pgsql Docs](https://osm2pgsql.org/doc/install.html)

---

### 5. 🐳 Start the Local Database (Optional but Recommended)

You can run the database using Docker. It’s like running a virtual machine with everything ready to go.

#### Step 1: Install Docker and Docker Compose

Follow the official guide here: [https://docs.docker.com/compose/install/](https://docs.docker.com/compose/install/)

#### Step 2: Start the database

Inside the `openvista-ai` folder, run:

```sh
docker compose up -d
```

This will start the database in the background.

---

### 6. 🧪 Start Drizzle Studio (to see your database visually)

Drizzle Studio is a tool to manage and inspect your database.

Run:

```sh
pnpm run dev
```

This will also start your development server.

---

## 🌐 GIS Data Setup (For Maps and Land Info)

We include a built-in tool to download and load geographic data into your database.

### 7. 📥 Download GIS Data

Run:

```sh
pnpm run gis-loader download
```

This will fetch necessary map and land data.

### 8. 📤 Import GIS Data into the Database

After downloading, import the data into your local database:

```sh
pnpm run gis-loader import
```

You only need to do this once unless you update the data.

---

## 🔄 Updating Your Local Project From GitHub

To get the latest code updates from the team:

1. Open your terminal and go to the project folder:

```sh
cd openvista-ai
```

2. Pull the latest changes:

```sh
git pull
```

3. Reinstall new dependencies (if any):

```sh
pnpm install
```

---

## Contributing

(Add contributing guidelines here)

## License

(Add license information here)