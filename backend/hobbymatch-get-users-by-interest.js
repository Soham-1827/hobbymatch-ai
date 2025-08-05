const {DynamoDBClient, PutItemCommand, QueryCommand} = require("@aws-sdk/client-dynamodb");

const client = new DynamoDBClient({ region: "us-east-1" });

exposts.handler = async (event) => {
    console.log('Event received:', JSON.stringify(event, null, 2));

    try{
        const interest = event.pathParameters?.interest;

        if(!interest){
            return{
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({
                    message: 'Interest parameter is required'
                })
            };
        }

        const normalizedInterest = interest.toLowerCase();
        const params = {
            TableName: "hobbymatch-user-interests",
            KeyConditionExpression: "interest = :interest",
            ExpressionAttributeValues: {
                ":interest": { S: normalizedInterest }
            },

            Limit: 50
        };

        console.log('Querying with params:', JSON.stringify(params, null, 2));
        const result = await client.send(new QueryCommand(params));

        const users = result.Items.map(item => ({
            userId: item.userId.S,
            userName: item.userName.S,
            userEmail: item.userEmail.S,
            addedAt: item.addedAt.S
        }));

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                interest: normalizedInterest,
                users: users,
                count: users.length,
                hasMore: result.LastEvaluatedKey ? true : false 
            })
        };
    }
    catch (error) {
        console.error('Error processing request:', error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                message: 'Error retrieving users',
                // Only in dev - remove in production
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            })
        };
    }
}