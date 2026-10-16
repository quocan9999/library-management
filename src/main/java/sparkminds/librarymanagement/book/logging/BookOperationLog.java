package sparkminds.librarymanagement.book.logging;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/** Đánh dấu thao tác nghiệp vụ sách cần ghi nhận thời lượng và kết quả đã được làm sạch. */
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface BookOperationLog {
    String value();
}
