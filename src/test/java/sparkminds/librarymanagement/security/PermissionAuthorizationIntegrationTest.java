package sparkminds.librarymanagement.security;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import tools.jackson.databind.ObjectMapper;

@SpringBootTest(properties = {
        "app.jwt.secret-base64=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
        "app.jwt.access-token-validity-seconds=900"
})
@AutoConfigureMockMvc
@Import(PermissionAuthorizationIntegrationTest.PermissionProbeController.class)
class PermissionAuthorizationIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Test
    void adminWithBookCreatePermissionCanAccessProtectedOperation() throws Exception {
        String token = login("admin", "admin");

        mockMvc.perform(get("/test/permissions/book-create").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.permission").value("book:create"));
    }

    @Test
    void userWithoutBookCreatePermissionGetsJsonForbidden() throws Exception {
        String email = "phase7-" + UUID.randomUUID() + "@example.test";
        jdbcTemplate.update("""
                INSERT INTO accounts (username, email, password_hash, role_id, email_verified, enabled, created_at,
                                      updated_at)
                SELECT NULL, ?, ?, id, TRUE, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                FROM roles WHERE code = 'ROLE_USER'
                """, email, passwordEncoder.encode("user-password"));

        try {
            String token = login(email, "user-password");
            mockMvc.perform(get("/auth/me").header("Authorization", "Bearer " + token))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.authorities", hasItem("ROLE_USER")))
                    .andExpect(jsonPath("$.authorities", hasItem("book:read")))
                    .andExpect(jsonPath("$.authorities", not(hasItem("book:create"))));

            mockMvc.perform(get("/test/permissions/book-create")
                            .header("Authorization", "Bearer " + token))
                    .andExpect(status().isForbidden())
                    .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                    .andExpect(jsonPath("$.status").value(403))
                    .andExpect(jsonPath("$.code").value("FORBIDDEN"))
                    .andExpect(jsonPath("$.message").value("Bạn không có quyền thực hiện thao tác này"))
                    .andExpect(jsonPath("$.errors").isEmpty())
                    .andExpect(content().string(not(containsString("AccessDeniedException"))));
        } finally {
            jdbcTemplate.update("DELETE FROM accounts WHERE email = ?", email);
        }
    }

    @Test
    void unauthenticatedUserGetsJsonUnauthorizedForProtectedOperation() throws Exception {
        mockMvc.perform(get("/test/permissions/book-create"))
                .andExpect(status().isUnauthorized())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.status").value(401))
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
    }

    private String login(String identifier, String password) throws Exception {
        MvcResult result = mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "identifier", identifier,
                                "password", password))))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString())
                .get("accessToken")
                .asText();
    }

    @RestController
    static class PermissionProbeController {

        @GetMapping("/test/permissions/book-create")
        @PreAuthorize("hasAuthority('book:create')")
        Map<String, String> requireBookCreatePermission() {
            return Map.of("permission", "book:create");
        }
    }
}
