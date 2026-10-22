package sparkminds.librarymanagement.integration.loan;

import com.jayway.jsonpath.JsonPath;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class BorrowOpenApiIntegrationTests {

    @Autowired
    private MockMvc mockMvc;

    @Test
    @SuppressWarnings("unchecked")
    void documentsEveryBorrowRouteWithBearerSecurityAndOperationSummary() throws Exception {
        String json = mockMvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        Map<String, Object> paths = JsonPath.read(json, "$.paths");
        List<Endpoint> endpoints = List.of(
                new Endpoint("/api/v1/catalog/books", "get"),
                new Endpoint("/api/v1/catalog/books/{bookId}", "get"),
                new Endpoint("/api/v1/borrow-requests", "post"),
                new Endpoint("/api/v1/borrow-requests/mine", "get"),
                new Endpoint("/api/v1/borrow-requests/mine/{loanCode}", "get"),
                new Endpoint("/api/v1/borrow-requests/mine/{loanCode}/items/{itemId}/cancel", "post"),
                new Endpoint("/api/v1/borrow-requests/mine/{loanCode}/items/{itemId}/renew", "post"),
                new Endpoint("/api/v1/borrow-requests/mine/{loanCode}/items/{itemId}/history", "get"),
                new Endpoint("/api/v1/librarian/borrow-requests", "get"),
                new Endpoint("/api/v1/librarian/pickups/{pickupReference}", "get"),
                new Endpoint("/api/v1/librarian/borrow-requests/{loanCode}/history", "get"),
                new Endpoint("/api/v1/librarian/borrow-requests/{loanCode}/items/{itemId}/prepare", "post"),
                new Endpoint("/api/v1/librarian/borrow-requests/{loanCode}/items/{itemId}/ready", "post"),
                new Endpoint("/api/v1/librarian/borrow-requests/{loanCode}/items/{itemId}/cancel", "post"),
                new Endpoint("/api/v1/librarian/borrow-requests/{loanCode}/items/{itemId}/reject", "post"),
                new Endpoint("/api/v1/librarian/borrow-requests/{loanCode}/handover", "post"));

        for (Endpoint endpoint : endpoints) {
            Map<String, Object> path = (Map<String, Object>) paths.get(endpoint.path());
            assertThat(path).as("OpenAPI path %s", endpoint.path()).isNotNull();
            Map<String, Object> operation = (Map<String, Object>) path.get(endpoint.method());
            assertThat(operation).as("OpenAPI %s %s", endpoint.method(), endpoint.path()).isNotNull();
            assertThat(operation.get("summary")).as("summary for %s", endpoint.path()).isInstanceOf(String.class);
            assertThat((String) operation.get("summary")).isNotBlank();
            assertThat((List<Map<String, Object>>) operation.get("security"))
                    .as("Bearer security for %s", endpoint.path())
                    .anySatisfy(requirement -> assertThat(requirement).containsKey("bearerAuth"));
        }

        Map<String, Object> handover = (Map<String, Object>) ((Map<String, Object>) paths
                .get("/api/v1/librarian/borrow-requests/{loanCode}/handover")).get("post");
        Map<String, Object> requestBody = (Map<String, Object>) handover.get("requestBody");
        Map<String, Object> content = (Map<String, Object>) requestBody.get("content");
        assertThat(content).containsKey("application/json");
        Map<String, Object> responses = (Map<String, Object>) handover.get("responses");
        assertThat(responses.keySet()).contains("200", "401", "403", "409", "422", "500");
        assertThat((Map<String, Object>) responses.get("200")).containsKey("content");
        assertThat((Map<String, Object>) responses.get("401")).containsKey("content");
    }

    private record Endpoint(String path, String method) {
    }
}
