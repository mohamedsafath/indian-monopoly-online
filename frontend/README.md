# Frontend

The frontend is a JavaScript/JSX single-page application built with React 19, React Router DOM 7, and Vite 8. It uses Socket.IO Client for game events and Tailwind CSS with authored CSS for styling. The complete verified stack, including declared dependency ranges and deployment notes, is documented in the repository [README](../README.md#-technology-stack).

## Development

From this directory:

```bash
npm install
npm run dev
```

The Vite development server prints the local URL when it starts. Set `VITE_BACKEND_URL` in the frontend environment to the backend's base URL; it defaults to `http://localhost:5001`.

## Available scripts

* `npm run dev` starts Vite's development server.
* `npm run build` creates the production bundle in `dist/`.
* `npm run preview` serves the production bundle locally.
* `npm run lint` runs ESLint on the frontend source.
