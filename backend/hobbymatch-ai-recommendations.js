const { DynamoDBClient, GetItemCommand } = require("@aws-sdk/client-dynamodb");
const https = require("https");

const dynamoClient = new DynamoDBClient({ region: "us-east-1" });

// Helper function to call OpenAI API
function callOpenAI(prompt, apiKey) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      model: "gpt-5-mini",
      input: [
        {
          role: "system",
          content: "You are a helpful hobby recommendation assistant...",
        },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" }, // ask for strict JSON
      temperature: 0.7,
      max_output_tokens: 500,
    });

    const options = {
      hostname: "api.openai.com",
      path: "/v1/responses",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "Content-Length": Buffer.byteLength(data),
      },
    };

    const req = https.request(options, (res) => {
      let responseData = "";

      res.on("data", (chunk) => {
        responseData += chunk;
      });

      res.on("end", () => {
        try {
          const parsed = JSON.parse(responseData);
          resolve(parsed);
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

exports.handler = async (event) => {
  console.log("Event received:", JSON.stringify(event, null, 2));

  try {
    const body = JSON.parse(event.body || "{}");

    // Validate input
    if (!body.userId && !body.interests) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({
          message: "Either userId or interests array is required",
        }),
      };
    }

    let interests = body.interests || [];
    let preferences = body.preferences || {};

    // If userId provided, fetch user data
    if (body.userId) {
      const params = {
        TableName: "hobbymatch-users",
        Key: {
          userId: { S: body.userId },
        },
      };

      const userData = await dynamoClient.send(new GetItemCommand(params));

      if (userData.Item) {
        interests =
          userData.Item.preferences?.M?.interests?.L?.map((i) => i.S) || [];
        preferences = {
          timeAvailable: userData.Item.preferences?.M?.timeAvailable?.S,
          budget: userData.Item.preferences?.M?.budget?.S,
          skillLevel: userData.Item.preferences?.M?.skillLevel?.S,
        };
      }
    }

    // Build prompt for ChatGPT
    const prompt = `Based on these interests: ${interests.join(", ")}
        Time available: ${preferences.timeAvailable || "flexible"}
        Budget: ${preferences.budget || "medium"}
        Skill level: ${preferences.skillLevel || "beginner"}
        
        Recommend 3-5 hobbies that would be a good fit. For each hobby, include:
        - name: hobby name
        - description: brief description
        - whyGoodFit: why it matches their interests
        - estimatedCost: startup cost estimate
        - timeCommitment: weekly time needed
        - difficulty: beginner/intermediate/advanced
        
        Return as a JSON array.`;

    // Get API key from environment variable
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OpenAI API key not configured");
    }

    // Call OpenAI
    const aiResponse = await callOpenAI(prompt, apiKey);

    // Parse the AI response
    let recommendations = [];
    try {
      const content =
        aiResponse.output_text ??
        aiResponse.output?.[0]?.content?.[0]?.text ??
        "";
      recommendations = JSON.parse(content);
    } catch (parseError) {
      console.error("Error parsing AI response:", parseError);
      // Fallback recommendations
      recommendations = [
        {
          name: "Photography",
          description: "Capture moments and express creativity through images",
          whyGoodFit: "Combines technical skills with artistic expression",
          estimatedCost: "$200-500",
          timeCommitment: "5-10 hours/week",
          difficulty: "beginner",
        },
      ];
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        recommendations: recommendations,
        basedOn: {
          interests: interests,
          preferences: preferences,
        },
      }),
    };
  } catch (error) {
    console.error("Error:", error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        message: "Error generating recommendations",
        error: error.message,
      }),
    };
  }
};
