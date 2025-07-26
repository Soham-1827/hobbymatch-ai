const { DynamoDBClient, PutItemCommand, BatchWriteItemCommand } = require("@aws-sdk/client-dynamodb");
const crypto = require('crypto');

const client = new DynamoDBClient({ region: "us-east-1" });

exports.handler = async (event) => {
    console.log('Event received:', JSON.stringify(event, null, 2));
    
    try {
        const body = JSON.parse(event.body || '{}');
        
        // Validate required fields
        if (!body.email || !body.name) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({
                    message: 'Email and name are required'
                })
            };
        }
        
        // Generate proper UUID
        const userId = 'user_' + crypto.randomUUID();
        const timestamp = new Date().toISOString();
        
        // 1. Save to main users table
        const userParams = {
            TableName: "hobbymatch-users",
            Item: {
                userId: { S: userId },
                email: { S: body.email },
                name: { S: body.name },
                createdAt: { S: timestamp },
                updatedAt: { S: timestamp },
                preferences: {
                    M: {
                        interests: { 
                            L: (body.preferences?.interests || []).map(interest => ({ S: interest }))
                        },
                        timeAvailable: { S: body.preferences?.timeAvailable || 'flexible' },
                        budget: { S: body.preferences?.budget || 'medium' },
                        skillLevel: { S: body.preferences?.skillLevel || 'beginner' }
                    }
                },
                hobbyCount: { N: String(body.preferences?.interests?.length || 0) },
                isActive: { BOOL: true }
            }
        };
        
        await client.send(new PutItemCommand(userParams));
        
        // 2. Save interests to user-interests table
        const interests = body.preferences?.interests || [];
        if (interests.length > 0) {
            const interestItems = interests.map(interest => ({
                PutRequest: {
                    Item: {
                        interest: { S: interest.toLowerCase() }, // Lowercase for consistent queries
                        userId: { S: userId },
                        userName: { S: body.name },
                        userEmail: { S: body.email },
                        addedAt: { S: timestamp }
                    }
                }
            }));
            
            const batchParams = {
                RequestItems: {
                    "hobbymatch-user-interests": interestItems
                }
            };
            
            await client.send(new BatchWriteItemCommand(batchParams));
        }
        
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                message: 'User created successfully',
                userId: userId,
                email: body.email,
                interestsAdded: interests.length
            })
        };
        
    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                message: 'Error creating user',
                error: error.message
            })
        };
    }
};