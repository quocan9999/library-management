package sparkminds.librarymanagement.regression.api;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import sparkminds.librarymanagement.common.api.GlobalExceptionHandler;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class GlobalExceptionHandlerRegressionTests {

    @Test
    void unexpectedErrorHasSafeContract() throws Exception {
        MockMvc mvc = MockMvcBuilders.standaloneSetup(new FailingController())
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();

        mvc.perform(get("/test/unexpected").accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.status").value(500))
                .andExpect(jsonPath("$.code").value("INTERNAL_ERROR"))
                .andExpect(jsonPath("$.message").value("Đã xảy ra lỗi hệ thống"))
                .andExpect(jsonPath("$.timestamp").isNotEmpty())
                .andExpect(result -> assertThat(result.getResponse().getContentAsString())
                        .doesNotContain("SECRET_INTERNAL_DETAIL", "IllegalStateException"));
    }

    @RestController
    static class FailingController {
        @GetMapping("/test/unexpected")
        public String fail() {
            throw new IllegalStateException("SECRET_INTERNAL_DETAIL");
        }
    }
}
