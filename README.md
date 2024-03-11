# The Driver API

![image](https://github.com/nazzarkevich/driver-app-api/assets/110843343/50b08d7d-896d-41bc-b3e4-84f1c5a275ea)

## Logistics Project

This project provides an API for managing logistics operations, including users, parcels, vehicles, journeys, drivers, and couriers. 

## Features

1. **User Management:** Easily manage user accounts, authentication, and authorization to ensure secure access to the system.
2. **Parcel Tracking:** Track parcels in real-time, from pickup to delivery, enabling stakeholders to monitor shipment progress and ensure timely arrivals.
3. **Vehicle Management:** Efficiently manage a fleet of vehicles, including tracking vehicle locations, maintenance schedules, and driver assignments.
4. **Journey Tracking:** Monitor and optimize journey routes, durations, and schedules to maximize efficiency and minimize delivery times.
5. **Driver and Courier Management:** Assign drivers and couriers to specific journeys or parcels, track their availability, and manage their schedules effectively.

## API Endpoints

- `/users`: CRUD operations for managing user accounts.
- `/parcels`: Track parcels, update statuses, and manage shipments.
- `/vehicles`: Manage vehicle information, including location, status, and maintenance records.
- `/journeys`: Create, update, and monitor journey details, including routes and schedules.
- `/drivers`: Manage driver information, availability, and assignments.
- `/couriers`: Track courier details, assignments, and performance metrics.

## Installation

- Packages
```bash
$ yarn install
```

- PostgreSQL should be installed
  
- Prisma (.env file should be added to the project)
```bash
$ npx prisma generate
$ npx prisma migrate dev
$ npx prisma db push
```

## Running the app

```bash
# development watch mode 
$ yarn start:dev

# production mode
$ yarn run start:prod
```

## DB

![image](https://github.com/nazzarkevich/driver-app-api/assets/110843343/9e8cc89a-3dff-4a04-bb8d-74954144f096)

