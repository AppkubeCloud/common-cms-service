package node

import (
	"cms/db"
	"cms/models"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"

	"github.com/aws/aws-lambda-go/events"
	lambda "github.com/icarus-sullivan/mock-lambda"
)

func Handler(ctx context.Context, request events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	var nodeDetails models.Node

	fmt.Println(request.Body)
	if err := json.Unmarshal([]byte(request.Body), &nodeDetails); err != nil {
		log.Printf("Error decoding request body: %s", err)
		return events.APIGatewayProxyResponse{StatusCode: 400, Body: "Invalid request body"}, nil
	}

	if err := saveNodeDetails(nodeDetails); err != nil {
		log.Printf("Error saving NodeDetails: %s", err)
		return events.APIGatewayProxyResponse{StatusCode: 500, Body: "Internal Server Error"}, nil
	}

	// responseBody, err := json.Marshal(map[string]interface{}{
	// 	"message": "Details saved successfully!",
	// })
	// if err != nil {
	// 	log.Printf("Error encoding response body: %s", err)
	// 	return events.APIGatewayProxyResponse{StatusCode: 500, Body: "Error encoding response body"}, nil
	// }

	return events.APIGatewayProxyResponse{
		StatusCode: http.StatusOK,
		Body:       "node created successfully",
	}, nil

}

// func Handler(ctx context.Context, request events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
// 	var buf bytes.Buffer

// 	// Construct the response body

// 	fmt.Println(request.Body)
// 	body, err := json.Marshal(map[string]interface{}{
// 		"message": "Go Serverless v1.0! Your function executed successfully!",
// 	})
// 	if err != nil {
// 		return events.APIGatewayProxyResponse{StatusCode: 500}, err
// 	}
// 	json.HTMLEscape(&buf, body)

// 	// Construct and return the API Gateway Proxy Response
// 	resp := events.APIGatewayProxyResponse{
// 		StatusCode:      200,
// 		IsBase64Encoded: false,
// 		Body:            buf.String(),
// 		Headers: map[string]string{
// 			"Content-Type":           "application/json",
// 			"X-MyCompany-Func-Reply": "hello-handler",
// 		},
// 	}

// 	return resp, nil
// }

func saveNodeDetails(details models.Node) error {
	db.InitDB()

	defer func() {
		if err := db.GetDB().Close(); err != nil {
			log.Printf("Error closing database connection: %s", err)
		}
	}()

	_, err := db.GetDB().Exec("INSERT INTO nodes (node_name, node_description) VALUES ($1, $2)", details.NodeName, details.NodeDescription)
	if err != nil {
		log.Printf("Error executing database query: %s", err)
		return err
	}

	return nil
}

func main() {
	lambda.Start(Handler)
}
