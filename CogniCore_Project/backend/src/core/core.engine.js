import { detectIntent } from "./intent.detector.js";
import { getTool } from "./tool.router.js";
import { runDynamicQuery } from "./dynamic.query.engine.js";


export async function runCoreEngine({
  query,
  organization,
  role
}) {

  console.log("\n==============================");
  console.log("🧠 CORE ENGINE RECEIVED QUERY:");
  console.log(query);
  console.log("==============================");


  const intent =
    detectIntent(
      query,
      organization
    );


  console.log(
    "🎯 DETECTED INTENT:",
    intent
  );


  // ==========================================
  // ONLY THESE INTENTS SHOULD USE FIXED TOOLS
  // ==========================================

  const configuredIntents = [

    "student_count",

    "foreign_students",

    "cgpa",

    "cardiology"

  ];


  // ==========================================
  // USE CONFIGURED TOOL ONLY FOR KNOWN INTENTS
  // ==========================================

  if (
    configuredIntents.includes(intent)
  ) {

    const tool =
      getTool(intent);


    if (tool) {

      console.log(
        "🔧 USING CONFIGURED TOOL:",
        tool.name
      );


      const result =
        await tool.execute({
          query,
          organization,
          role
        });


      return {
        answer: result.answer,

        intent,

        tool: tool.name,

        data: result.data,

        meta: {
          organization,
          role,

          engineMode:
            "configured_tool"
        }
      };
    }
  }


  // ==========================================
  // EVERYTHING ELSE → DYNAMIC QUERY ENGINE
  // ==========================================

  console.log(
    "🔥 USING DYNAMIC QUERY ENGINE"
  );


  const dynamicResult =
    await runDynamicQuery(
      query
    );


  return {
    answer:
      dynamicResult.answer,

    intent:
      dynamicResult.success
        ? "dynamic_query"
        : "unknown",

    tool:
      "Dynamic Query Engine",

    data:
      dynamicResult.data,

    meta: {
      organization,
      role,

      engineMode:
        "dynamic_query"
    }
  };
}