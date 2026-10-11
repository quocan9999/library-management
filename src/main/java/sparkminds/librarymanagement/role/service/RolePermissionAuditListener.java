package sparkminds.librarymanagement.role.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
public class RolePermissionAuditListener {

    private static final Logger logger = LoggerFactory.getLogger(RolePermissionAuditListener.class);

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void logSuccessfulUpdate(RolePermissionAuditEvent event) {
        logger.info(
                "role-permission-update actorId={} roleCode={} addedPermissions={} removedPermissions={} occurredAt={}",
                event.actorId(),
                event.roleCode(),
                event.addedPermissions(),
                event.removedPermissions(),
                event.occurredAt()
        );
    }
}
