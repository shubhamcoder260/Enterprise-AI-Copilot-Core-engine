import { runCoreEngine } from "../core/core.engine.js";

export async function handleQuery(req, res) {
  try {
    const { query, organization = "college", role = "admin" } = req.body;

    if (!query || typeof query !== "string") {
      return res.status(400).json({ error: "Please provide a query." });
    }

    const result = await runCoreEngine({ query, organization, role });
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Engine error", message: error.message });
  }
}
