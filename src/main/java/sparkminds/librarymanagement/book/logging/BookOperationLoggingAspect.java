package sparkminds.librarymanagement.book.logging;

import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.springframework.stereotype.Component;

/** Ghi nhận kết quả thao tác sách mà không đưa request, response hoặc nội dung lỗi vào log. */
@Aspect
@Component
@Slf4j
public class BookOperationLoggingAspect {

    /**
     * Ghi nhận mã thao tác, trạng thái, thời lượng và loại exception nếu có.
     *
     * <p>Không đọc arguments, kết quả hay exception message vì chúng có thể chứa ISBN, dữ liệu người dùng
     * hoặc nội dung CSV do Admin tải lên.
     */
    @Around("@annotation(operation)")
    public Object logOperation(ProceedingJoinPoint joinPoint, BookOperationLog operation) throws Throwable {
        long startedAt = System.nanoTime();
        try {
            Object result = joinPoint.proceed();
            log.info("book-operation operation={} outcome=success durationMs={}",
                    operation.value(), elapsedMillis(startedAt));
            return result;
        } catch (Throwable exception) {
            log.warn("book-operation operation={} outcome=failure exceptionType={} durationMs={}",
                    operation.value(), exception.getClass().getSimpleName(), elapsedMillis(startedAt));
            throw exception;
        }
    }

    private static long elapsedMillis(long startedAt) {
        return (System.nanoTime() - startedAt) / 1_000_000;
    }
}
