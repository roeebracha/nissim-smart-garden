# Garden dashboard

One screen for the two pots. Vite, React, TypeScript, and shadcn/ui (decision 24).

```bash
npm install
npm run dev
```

Open `http://localhost:5173` against the backend, or `http://localhost:5173/?demo=1` for mocked readings and a visible approve button.

`VITE_API_BASE` defaults to `http://localhost:3000`. The backend allows that browser origin only when `FRONTEND_ORIGIN` is set.
