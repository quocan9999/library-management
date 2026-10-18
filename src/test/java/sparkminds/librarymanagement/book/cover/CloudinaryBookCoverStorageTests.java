package sparkminds.librarymanagement.book.cover;

import com.cloudinary.Cloudinary;
import com.cloudinary.Uploader;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpStatus;
import sparkminds.librarymanagement.common.api.BusinessException;
import sparkminds.librarymanagement.config.CloudinaryProperties;

import java.io.IOException;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class CloudinaryBookCoverStorageTests {
    private Cloudinary cloudinary;
    private Uploader uploader;
    private CloudinaryProperties properties;
    private CloudinaryBookCoverStorage storage;

    @BeforeEach
    void setUp() {
        cloudinary = mock(Cloudinary.class);
        uploader = mock(Uploader.class);
        properties = new CloudinaryProperties();
        properties.setCloudName("test-cloud");
        properties.setApiKey("test-key");
        properties.setApiSecret("test-secret");
        storage = new CloudinaryBookCoverStorage(cloudinary, properties);
    }

    @Test
    void usesServerGeneratedIdAndRestrictsUploadsToImages() throws Exception {
        properties.setBookCoverFolder("/library_management/book_cover/");
        when(cloudinary.uploader()).thenReturn(uploader);
        when(uploader.upload(any(), anyMap())).thenAnswer(invocation -> {
            Map<?, ?> options = invocation.getArgument(1);
            assertThat(options.get("resource_type")).isEqualTo("image");
            assertThat(options.get("overwrite")).isEqualTo(false);
            assertThat(options.get("asset_folder")).isEqualTo("library_management/book_cover");
            return Map.of("public_id", options.get("public_id"), "secure_url", "https://res.cloudinary.com/test/cover.png");
        });
        UploadedBookCover cover = storage.upload(new byte[]{1, 2, 3});
        assertThat(cover.url()).isEqualTo("https://res.cloudinary.com/test/cover.png");
        assertThat(cover.publicId()).startsWith("library_management/book_cover/");
    }

    @Test
    void missingCredentialsReturnServiceUnavailableWithoutNetworkCall() {
        properties.setApiSecret("");
        assertThatThrownBy(() -> storage.upload(new byte[]{1}))
                .isInstanceOfSatisfying(BusinessException.class, error -> assertThat(error.getStatus()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE));
        verifyNoInteractions(cloudinary);
    }

    @Test
    void uploadFailureAttemptsCleanupAndDoesNotExposeProviderError() throws Exception {
        when(cloudinary.uploader()).thenReturn(uploader);
        when(uploader.upload(any(), anyMap())).thenThrow(new IOException("sensitive provider response"));
        when(uploader.destroy(anyString(), anyMap())).thenReturn(Map.of("result", "ok"));
        assertThatThrownBy(() -> storage.upload(new byte[]{1}))
                .isInstanceOfSatisfying(BusinessException.class, error -> {
                    assertThat(error.getStatus()).isEqualTo(HttpStatus.BAD_GATEWAY);
                    assertThat(error.getMessage()).doesNotContain("sensitive provider response");
                });
        ArgumentCaptor<String> id = ArgumentCaptor.forClass(String.class);
        verify(uploader).destroy(id.capture(), anyMap());
        assertThat(id.getValue()).startsWith("library_management/book_cover/");
    }

    @Test
    void rejectsInsecureOrIncompleteResponseAndCleansUploadedAsset() throws Exception {
        when(cloudinary.uploader()).thenReturn(uploader);
        when(uploader.upload(any(), anyMap())).thenReturn(Map.of("secure_url", "http://example.test/cover"));
        when(uploader.destroy(anyString(), anyMap())).thenReturn(Map.of("result", "not found"));
        assertThatThrownBy(() -> storage.upload(new byte[]{1})).isInstanceOf(BusinessException.class);
        verify(uploader).destroy(anyString(), anyMap());
    }
}
