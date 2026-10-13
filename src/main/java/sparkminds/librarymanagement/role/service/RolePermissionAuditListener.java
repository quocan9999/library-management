package sparkminds.librarymanagement.role.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
@Slf4j
public class RolePermissionAuditListener {

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void logSuccessfulUpdate(RolePermissionAuditEvent event) {
        log.info(
                "role-permission-update actorId={} roleCode={} addedPermissions={} removedPermissions={} occurredAt={}",
                event.actorId(),
                event.roleCode(),
                event.addedPermissions(),
                event.removedPermissions(),
                event.occurredAt()
        );
    }
}
