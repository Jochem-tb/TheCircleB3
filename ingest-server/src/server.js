import express from "express";
import morgan from "morgan";
import whipRouter from "./whipRouter.js";

const app = express();
const PORT = process.env.PORT || 8090;

app.use(morgan("dev"));
app.use(express.json());
app.use("/whip", whipRouter);

app.listen(PORT, () => {
    console.log(`Ingest server running on port ${PORT}`);
});
