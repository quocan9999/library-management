package sparkminds.librarymanagement.book.cover;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockMultipartFile;
import sparkminds.librarymanagement.common.api.BusinessException;
import sparkminds.librarymanagement.common.api.FieldValidationException;

import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import javax.imageio.ImageIO;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class BookCoverServiceTests {
    private BookCoverStorage storage;
    private BookCoverService service;

    @BeforeEach
    void setUp() {
        storage = mock(BookCoverStorage.class);
        service = new BookCoverService(storage);
    }

    @ParameterizedTest
    @ValueSource(strings = {"png", "jpg"})
    void acceptsDecodedImagesRegardlessOfUntrustedFilename(String format) throws Exception {
        ByteArrayOutputStream image = new ByteArrayOutputStream();
        ImageIO.write(new BufferedImage(2, 3, BufferedImage.TYPE_INT_RGB), format, image);
        when(storage.upload(any())).thenReturn(new UploadedBookCover("https://example.test/cover", "server-id"));
        UploadedBookCover result = service.uploadOptional(new MockMultipartFile("cover", "../../untrusted", "application/octet-stream", image.toByteArray()));
        assertThat(result.url()).isEqualTo("https://example.test/cover");
        verify(storage).upload(image.toByteArray());
    }

    @Test
    void rejectsFakeAndEmptyImageBeforeCallingProvider() {
        assertThatThrownBy(() -> service.uploadOptional(new MockMultipartFile("cover", "image.png", "image/png", "not an image".getBytes())))
                .isInstanceOf(FieldValidationException.class);
        assertThatThrownBy(() -> service.uploadOptional(new MockMultipartFile("cover", new byte[0])))
                .isInstanceOf(FieldValidationException.class);
        verifyNoInteractions(storage);
    }

    @Test
    void rejectsOversizedImageBeforeCallingProvider() {
        assertThatThrownBy(() -> service.uploadOptional(new MockMultipartFile("cover", new byte[5 * 1024 * 1024 + 1])))
                .isInstanceOfSatisfying(BusinessException.class, error -> assertThat(error.getStatus()).isEqualTo(HttpStatus.PAYLOAD_TOO_LARGE));
        verifyNoInteractions(storage);
    }

    @Test
    void rejectsUnsupportedGifAndHugeImageDimensions() throws Exception {
        ByteArrayOutputStream gif = new ByteArrayOutputStream();
        ImageIO.write(new BufferedImage(2, 3, BufferedImage.TYPE_INT_RGB), "gif", gif);
        assertThatThrownBy(() -> service.uploadOptional(new MockMultipartFile("cover", gif.toByteArray())))
                .isInstanceOf(FieldValidationException.class);
        ByteArrayOutputStream png = new ByteArrayOutputStream();
        ImageIO.write(new BufferedImage(2, 3, BufferedImage.TYPE_INT_RGB), "png", png);
        byte[] content = png.toByteArray();
        java.nio.ByteBuffer.wrap(content, 16, 8).putInt(5000).putInt(5000);
        assertThatThrownBy(() -> service.uploadOptional(new MockMultipartFile("cover", content)))
                .isInstanceOf(FieldValidationException.class);
        verifyNoInteractions(storage);
    }

    @Test
    void optionalImageDoesNotRequireProvider() {
        assertThat(service.uploadOptional(null)).isNull();
        service.discard(null);
        verifyNoInteractions(storage);
    }

    @Test
    void cleanupFailureDoesNotMaskDatabaseOutcome() {
        doThrow(new IllegalStateException("private provider detail")).when(storage).delete("obsolete");
        org.junit.jupiter.api.Assertions.assertDoesNotThrow(() -> service.discard("obsolete"));
        verify(storage).delete("obsolete");
    }
}
