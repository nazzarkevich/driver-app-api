import { IsEnum, IsNotEmpty, IsNumber } from 'class-validator';

export enum ConnectionType {
  SAME_DESTINATION = 'SAME_DESTINATION',
  SAME_SENDER = 'SAME_SENDER',
  BULK_SHIPMENT = 'BULK_SHIPMENT',
  MANUAL = 'MANUAL',
}

export class CreateConnectionDto {
  @IsNumber()
  @IsNotEmpty()
  targetParcelId: number;

  @IsEnum(ConnectionType)
  @IsNotEmpty()
  connectionType: ConnectionType;
}

export class ConnectionResponseDto {
  id: number;
  parcelId: number;
  connectedToId: number;
  connectionType: string;
  createdAt: Date;

  parcel: {
    id: number;
    trackingNumber: string;
    sender: {
      firstName: string;
      lastName: string;
    };
  };

  connectedTo: {
    id: number;
    trackingNumber: string;
    recipient: {
      firstName: string;
      lastName: string;
    };
  };
}
