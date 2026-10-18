package sparkminds.librarymanagement.book.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.Operation;
import io.swagger.v3.oas.models.examples.Example;
import io.swagger.v3.oas.models.media.Encoding;
import org.springdoc.core.customizers.OpenApiCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class BookOpenApiConfiguration {

    /**
     * Springdoc ghép hai handler JSON/multipart cùng đường dẫn nhưng bỏ examples ở media type.
     * Lấy lại ví dụ từ DTO và khai báo encoding của part book để Swagger gửi đúng application/json.
     */
    @Bean
    public OpenApiCustomizer bookRequestBodyDocumentation() {
        return api -> {
            if (api.getPaths() == null) return;
            var create = api.getPaths().get("/api/v1/books");
            var update = api.getPaths().get("/api/v1/books/{id}");
            if (create != null) configureBody(api, create.getPost(), "CreateBookRequest", "Tạo sách");
            if (update != null) configureBody(api, update.getPut(), "UpdateBookRequest", "Cập nhật sách");
        };
    }

    private static void configureBody(OpenAPI api, Operation operation, String schemaName, String exampleName) {
        if (operation == null || operation.getRequestBody() == null || operation.getRequestBody().getContent() == null) return;
        var content = operation.getRequestBody().getContent();
        var json = content.get("application/json");
        if (json != null && api.getComponents() != null && api.getComponents().getSchemas() != null) {
            var schema = api.getComponents().getSchemas().get(schemaName);
            if (schema != null && schema.getExample() != null) {
                json.addExamples(exampleName, new Example().value(schema.getExample()));
            }
        }
        var multipart = content.get("multipart/form-data");
        if (multipart != null) multipart.addEncoding("book", new Encoding().contentType("application/json"));
    }
}
