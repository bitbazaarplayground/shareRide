// backend/admin/index.js
import express from "express";
import ridesRoutes from "./rides.js";
import usersRoutes from "./users.js";

const router = express.Router();
router.use("/rides", ridesRoutes);
router.use("/users", usersRoutes);

export default router;
