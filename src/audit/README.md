# Audit System Documentation

## Overview

The Audit System provides comprehensive action logging for your NestJS application. It tracks user actions, system events, and API calls automatically or manually.

## Features

- **Automatic Logging**: Global interceptor that automatically logs HTTP requests
- **Manual Logging**: Service methods for granular control over logging
- **Decorator Support**: Optional decorator for specific controller actions
- **Multi-tenant Support**: Business-scoped audit logs
- **Rich Metadata**: IP address, user agent, request/response data
- **Performance Tracking**: Request duration monitoring
- **Filtering & Search**: Comprehensive query capabilities

## Architecture

### Core Components

1. **AuditLog Model** - Database table storing audit records
2. **AuditService** - Service for creating and querying audit logs
3. **AuditInterceptor** - Global interceptor for automatic logging
4. **AuditController** - API endpoints for viewing audit logs
5. **AuditLog Decorator** - Manual logging decorator for controllers

### Database Schema

The `AuditLog` model includes:

- Basic info: `id`, `userId`, `action`, `entityType`, `entityId`
- Request context: `method`, `endpoint`, `ipAddress`, `userAgent`
- Performance: `duration`, `statusCode`
- Metadata: `description`, `metadata` (JSON)
- Business context: `businessId`

## Usage

### 1. Automatic Logging (Global Interceptor)

The `AuditInterceptor` is configured globally and automatically logs:

- All non-GET HTTP requests
- Failed GET requests (4xx/5xx status codes)
- Sensitive endpoint access (users, admin routes)

```typescript
// Configured in app.module.ts
{
  provide: APP_INTERCEPTOR,
  useClass: AuditInterceptor,
}
```

### 2. Manual Logging in Services

Inject `AuditService` into your services for granular control:

```typescript
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private readonly auditService: AuditService) {}

  async updateUser(
    id: number,
    data: UpdateUserDto,
    currentUser: UserRequestType,
  ) {
    // Your business logic here
    const updatedUser = await this.prisma.user.update({
      where: { id },
      data,
    });

    // Log the action
    await this.auditService.logUserAction(
      currentUser,
      AuditAction.UPDATE,
      'User',
      id.toString(),
      `Updated user profile for ${updatedUser.firstName} ${updatedUser.lastName}`,
      {
        updatedFields: Object.keys(data),
        previousValues: originalUser,
        newValues: data,
      },
    );

    return updatedUser;
  }
}
```

### 3. Manual Logging with Decorator

Use the `@AuditLog` decorator for controller-level logging:

```typescript
import { AuditLog } from '../decorators/audit-log.decorator';
import { AuditAction } from '@prisma/client';

@Controller('users')
export class UsersController {
  @Put('/:id')
  @AuditLog({
    action: AuditAction.UPDATE,
    entityType: 'User',
    description: 'Update user profile',
    includeRequestBody: true,
    includeResponseData: false,
  })
  async updateUser(@Param('id') id: string, @Body() data: UpdateUserDto) {
    // Your controller logic here
  }
}
```

### 4. System-Level Logging

For system actions without a user context:

```typescript
await this.auditService.logSystemAction(
  AuditAction.CREATE,
  'BackupJob',
  jobId,
  'Automated daily backup completed successfully',
  { backupSize: '1.2GB', duration: '5min' },
);
```

## API Endpoints

### Get Audit Logs

```
GET /audit/logs?page=1&limit=50&userId=123&action=UPDATE&startDate=2024-01-01&endDate=2024-12-31
```

### Get User-Specific Logs

```
GET /audit/logs/user/123?page=1&limit=50
```

### Get Audit Statistics

```
GET /audit/stats
```

## Available Actions

The `AuditAction` enum includes:

- `CREATE` - Creating new records
- `READ` - Reading/viewing data
- `UPDATE` - Updating existing records
- `DELETE` - Deleting records
- `LOGIN` - User authentication
- `LOGOUT` - User logout
- `SIGNUP` - New user registration
- `PASSWORD_CHANGE` - Password updates
- `ROLE_CHANGE` - User role modifications
- `PROFILE_UPDATE` - Profile changes
- `UPLOAD_FILE` - File uploads
- `DOWNLOAD_FILE` - File downloads
- `EXPORT_DATA` - Data exports
- `IMPORT_DATA` - Data imports
- `ARCHIVE` - Archiving records
- `RESTORE` - Restoring archived records
- `APPROVE` - Approval actions
- `REJECT` - Rejection actions
- `ASSIGN` - Assignment actions
- `UNASSIGN` - Unassignment actions
- `CUSTOM` - Custom actions

## Configuration

### Interceptor Filtering

The interceptor can be configured to skip certain endpoints:

```typescript
// In audit.interceptor.ts
private shouldLogRequest(method: string, endpoint: string, statusCode: number): boolean {
  // Skip health checks, swagger docs, etc.
  if (endpoint.includes('/health') ||
      endpoint.includes('/swagger') ||
      endpoint.includes('/api-docs')) {
    return false;
  }

  // Your custom logic here
  return true;
}
```

### Data Sanitization

Sensitive data is automatically redacted:

```typescript
private sanitizeRequestBody(body: any): any {
  const sensitiveFields = ['password', 'token', 'apiKey', 'secret'];
  // Sanitization logic
}
```

## Security Considerations

1. **Access Control**: Audit logs are restricted to Manager and Moderator roles
2. **Data Sanitization**: Sensitive fields are automatically redacted
3. **Business Isolation**: Users can only view logs from their business (unless admin)
4. **Size Limits**: Response data is truncated if too large (>5KB)

## Performance

- Audit logging is designed to be non-blocking
- Failed audit logs don't break main functionality
- Database indexes on key fields for fast queries
- Pagination support for large result sets

## Monitoring

Monitor audit log creation failures:

```typescript
// Logs are captured but errors don't throw
console.error('Failed to create audit log:', error);
```

## Best Practices

1. **Use Descriptive Messages**: Provide clear, human-readable descriptions
2. **Include Relevant Metadata**: Add context that helps with debugging
3. **Don't Log Sensitive Data**: Use sanitization for passwords, tokens, etc.
4. **Use Appropriate Actions**: Choose the most specific audit action
5. **Log Business Logic**: Focus on meaningful business events
6. **Consider Performance**: Audit logging shouldn't slow down your app

## Examples

### Login Tracking

```typescript
await this.auditService.logUserAction(
  user,
  AuditAction.LOGIN,
  'Authentication',
  undefined,
  `User ${user.email} logged in successfully`,
  { loginMethod: 'email', ipAddress: request.ip },
);
```

### Parcel Status Change

```typescript
await this.auditService.logUserAction(
  currentUser,
  AuditAction.UPDATE,
  'Parcel',
  parcelId,
  `Changed parcel status from ${oldStatus} to ${newStatus}`,
  {
    parcelId,
    oldStatus,
    newStatus,
    trackingNumber: parcel.trackingNumber,
  },
);
```

### File Upload

```typescript
await this.auditService.logUserAction(
  currentUser,
  AuditAction.UPLOAD_FILE,
  'Document',
  documentId,
  `Uploaded document: ${filename}`,
  {
    filename,
    fileSize: file.size,
    mimeType: file.mimetype,
  },
);
```
