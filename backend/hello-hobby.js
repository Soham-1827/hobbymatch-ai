// backend/hello-hobby.js
export async function handler(event) {
    console.log('Event received:', JSON.stringify(event, null, 2)); //For debugging in CloudWatch
    
    const response = {
        statusCode: 200,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'  // This prevents CORS (Cross-Origin Resource Sharing) errors, Enabled it in AWS API gateway
        },
        body: JSON.stringify({
            message: 'Welcome to HobbyMatch AI!',
            timestamp: new Date().toISOString(),
            version: '1.0.0'
        })
    };
    
    return response;
}
