package sparkminds.librarymanagement.book.cover;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
@RequiredArgsConstructor
public class BookCoverCleanupListener {
    private final BookCoverService coverService;

    @TransactionalEventListener
    public void afterCommit(BookCoverObsolete event) {
        coverService.discard(event.publicId());
    }
}
