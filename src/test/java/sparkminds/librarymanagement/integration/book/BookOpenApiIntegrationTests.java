package sparkminds.librarymanagement.integration.book;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import sparkminds.librarymanagement.book.service.BookQueryService;
import sparkminds.librarymanagement.common.api.BusinessException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@ExtendWith(OutputCaptureExtension.class)
class BookOpenApiIntegrationTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private BookQueryService bookQueryService;

    @Test
    void publishesBookContractsJwtSchemeAndExamples() throws Exception {
        mockMvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.components.securitySchemes.bearerAuth.scheme").value("bearer"))
                .andExpect(jsonPath("$.components.schemas.CreateBookRequest").exists())
                .andExpect(jsonPath("$.components.schemas.UpdateBookRequest").exists())
                .andExpect(jsonPath("$.components.schemas.BookImportReportResponse").exists())
                .andExpect(jsonPath("$.paths['/api/v1/books'].post.security[0].bearerAuth").exists())
                .andExpect(jsonPath("$.paths['/api/v1/books'].post.requestBody.content['application/json'].examples['Tạo sách'].value.title")
                        .value("Clean Code"))
                .andExpect(jsonPath("$.paths['/api/v1/books'].post.responses['409'].content['application/json'].examples['ISBN trùng']")
                        .exists())
                .andExpect(jsonPath("$.paths['/api/v1/books'].post.requestBody.content['multipart/form-data'].schema.properties.cover.format")
                        .value("binary"))
                .andExpect(jsonPath("$.paths['/api/v1/books'].post.requestBody.content['multipart/form-data'].encoding.book.contentType")
                        .value("application/json"))
                .andExpect(jsonPath("$.components.schemas.BookDetailResponse.properties.coverImageUrl").exists())
                .andExpect(jsonPath("$.paths['/api/v1/books/import'].post.requestBody.content['multipart/form-data']")
                        .exists())
                .andExpect(jsonPath("$.paths['/api/v1/books/import'].post.responses['200']").exists());
    }

    @Test
    void servesSwaggerUiPubliclyButKeepsBookApiAuthenticated() throws Exception {
        mockMvc.perform(get("/swagger-ui/index.html"))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/books"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void logsBookOperationsWithoutQueryText(CapturedOutput output) throws IOException {
        bookQueryService.search("private request value", null, null, null, null, null, null, null);

        assertThat(output.getOut()).contains("book-operation operation=book.search outcome=success")
                .doesNotContain("private request value");
        String fileLog = Files.readString(Path.of("logs", "library-management.log"));
        assertThat(fileLog).contains("book-operation operation=book.search outcome=success")
                .doesNotContain("private request value");
    }

    @Test
    void logsOnlyFailureTypeAndDoesNotWriteTheExceptionMessage(CapturedOutput output) throws IOException {
        assertThatThrownBy(() -> bookQueryService.search(null, null, "private date value", null,
                null, null, null, null))
                .isInstanceOf(BusinessException.class);

        assertThat(output.getOut()).contains("book-operation operation=book.search outcome=failure exceptionType=BusinessException")
                .doesNotContain("private date value", "publishedFrom phải có định dạng");
        String fileLog = Files.readString(Path.of("logs", "library-management.log"));
        assertThat(fileLog).contains("book-operation operation=book.search outcome=failure exceptionType=BusinessException")
                .doesNotContain("private date value", "publishedFrom phải có định dạng");
    }
}
