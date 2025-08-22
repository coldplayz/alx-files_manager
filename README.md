# Files Manager

This project is a compilation of back-end concepts: authentication, NodeJS, MongoDB, Redis, pagination and background processing.

The objective is to build a simple platform to upload and view files with:

- User authentication via a token
- Listing of all files
- Uploading a new file
- Changing permissions of a file
- Viewing a file
- Generating thumbnails for images

## Core technologies

|                                                                                                         |                                                                                      |                                                                                              |
| ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| ![Redis](https://upload.wikimedia.org/wikipedia/en/thumb/6/6b/Redis_Logo.svg/1000px-Redis_Logo.svg.png) | ![MongoDB](https://webassets.mongodb.com/_com_assets/cms/mongodb_logo1-76twgcu2dm.png) | ![NodeJS](https://d2eip9sf3oo6c2.cloudfront.net/tags/images/000/000/256/full/nodejslogo.png) |

## Installation

To run this project locally, you'll need to have the following installed:

*   [Node.js](https://nodejs.org/)
*   [npm](https://www.npmjs.com/) (comes with Node.js)
*   [MongoDB](https://www.mongodb.com/)
*   [Redis](https://redis.io/)

1.  **Clone the repository:**

    ```bash
    git clone https://github.com/your-username/files_manager.git
    cd files_manager
    ```

2.  **Install the dependencies:**

    ```bash
    npm install
    ```

## Usage

### Starting the Server

To start the API server, run the following command:

```bash
npm run start-server
```

The server will start on `http://localhost:5000` by default.

### Starting the Worker

This project uses a worker to process background jobs. To start the worker, run:

```bash
npm run start-worker
```

### Running Tests

To run the test suite, use the following command:

```bash
npm run test
```

## API Endpoints

### App Controller

*   `GET /status`
    *   Returns the status of Redis and the database.
*   `GET /stats`
    *   Returns the number of users and files in the database.

### Auth Controller

*   `GET /connect`
    *   Signs in the user by generating a new authentication token.
*   `GET /disconnect`
    *   Signs out the user based on the provided token.

### Users Controller

*   `POST /users`
    *   Creates a new user.
*   `GET /users/me`
    *   Retrieves the authenticated user's information.

### Files Controller

*   `POST /files`
    *   Uploads a new file.
*   `GET /files/:id`
    *   Retrieves the metadata for a specific file.
*   `GET /files`
    *   Lists all files with pagination.
*   `PUT /files/:id/publish`
    *   Makes a file public.
*   `PUT /files/:id/unpublish`
    *   Makes a file private.
*   `GET /files/:id/data`
    *   Retrieves the content of a file.

## License

This project is licensed under the ISC License.