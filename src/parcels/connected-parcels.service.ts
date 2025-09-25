import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

export enum ConnectionType {
  SAME_DESTINATION = 'SAME_DESTINATION',
  SAME_SENDER = 'SAME_SENDER',
  BULK_SHIPMENT = 'BULK_SHIPMENT',
  MANUAL = 'MANUAL',
}

export interface ConnectionCriteria {
  senderId?: number;
  recipientId?: number;
  destinationAddressId?: number;
  originAddressId?: number;
  timeWindow?: number; // hours
  businessId?: number;
}

@Injectable()
export class ConnectedParcelsService {
  constructor(private readonly prismaService: PrismaService) {}

  /**
   * Automatically connect parcels based on criteria
   */
  async autoConnectParcels(
    parcelId: number,
    criteria: ConnectionCriteria,
  ): Promise<void> {
    const targetParcel = await this.prismaService.parcel.findUnique({
      where: { id: parcelId },
      include: { sender: true, recipient: true },
    });

    if (!targetParcel) {
      throw new NotFoundException('Parcel not found');
    }

    // Find potential connections
    const potentialConnections = await this.findPotentialConnections(
      targetParcel,
      criteria,
    );

    // Create connections
    for (const connection of potentialConnections) {
      await this.createConnection(
        parcelId,
        connection.id,
        this.determineConnectionType(targetParcel, connection),
      );
    }
  }

  /**
   * Manually connect two parcels
   */
  async connectParcels(
    parcelId1: number,
    parcelId2: number,
    connectionType: ConnectionType,
  ): Promise<void> {
    if (parcelId1 === parcelId2) {
      throw new Error('Cannot connect parcel to itself');
    }

    // Check if connection already exists
    const existingConnection =
      await this.prismaService.connectedParcel.findFirst({
        where: {
          OR: [
            { parcelId: parcelId1, connectedToId: parcelId2 },
            { parcelId: parcelId2, connectedToId: parcelId1 },
          ],
        },
      });

    if (existingConnection) {
      return; // Connection already exists
    }

    await this.createConnection(parcelId1, parcelId2, connectionType);
  }

  /**
   * Get all connected parcels for a given parcel
   */
  async getConnectedParcels(parcelId: number) {
    const connections = await this.prismaService.connectedParcel.findMany({
      where: {
        OR: [{ parcelId }, { connectedToId: parcelId }],
      },
      include: {
        parcel: {
          include: {
            sender: true,
            recipient: true,
            originAddress: {
              include: {
                country: true,
              },
            },
            destinationAddress: {
              include: {
                country: true,
              },
            },
          },
        },
        connectedTo: {
          include: {
            sender: true,
            recipient: true,
            originAddress: {
              include: {
                country: true,
              },
            },
            destinationAddress: {
              include: {
                country: true,
              },
            },
          },
        },
      },
    });

    return connections.map((conn) => ({
      id: conn.id,
      connectionType: conn.connectionType,
      createdAt: conn.createdAt,
      connectedParcel:
        conn.parcelId === parcelId ? conn.connectedTo : conn.parcel,
      relationship: conn.parcelId === parcelId ? 'outgoing' : 'incoming',
    }));
  }

  /**
   * Remove connection between parcels
   */
  async disconnectParcels(parcelId1: number, parcelId2: number): Promise<void> {
    await this.prismaService.connectedParcel.deleteMany({
      where: {
        OR: [
          { parcelId: parcelId1, connectedToId: parcelId2 },
          { parcelId: parcelId2, connectedToId: parcelId1 },
        ],
      },
    });
  }

  /**
   * Get parcel groups (clusters of connected parcels)
   */
  async getParcelGroups(businessId?: number) {
    // This could be optimized with a graph algorithm
    const connections = await this.prismaService.connectedParcel.findMany({
      where: businessId
        ? {
            parcel: { businessId },
          }
        : undefined,
      include: {
        parcel: { include: { sender: true, recipient: true } },
        connectedTo: { include: { sender: true, recipient: true } },
      },
    });

    // Group parcels into clusters
    const groups = this.buildParcelGroups(connections);
    return groups;
  }

  private async findPotentialConnections(
    targetParcel: any,
    criteria: ConnectionCriteria,
  ) {
    const timeWindow = criteria.timeWindow || 24; // Default 24 hours
    const cutoffTime = new Date(Date.now() - timeWindow * 60 * 60 * 1000);

    return await this.prismaService.parcel.findMany({
      where: {
        AND: [
          { id: { not: targetParcel.id } }, // Exclude self
          { businessId: criteria.businessId || targetParcel.businessId },
          { createdAt: { gte: cutoffTime } },
          { isDeleted: false },
          // Connection criteria
          criteria.senderId ? { senderId: criteria.senderId } : {},
          criteria.recipientId ? { recipientId: criteria.recipientId } : {},
          criteria.destinationAddressId
            ? { destinationAddressId: criteria.destinationAddressId }
            : {},
          criteria.originAddressId
            ? { originAddressId: criteria.originAddressId }
            : {},
        ],
      },
      include: { sender: true, recipient: true },
    });
  }

  private determineConnectionType(parcel1: any, parcel2: any): ConnectionType {
    if (
      parcel1.senderId === parcel2.senderId &&
      parcel1.destinationAddressId === parcel2.destinationAddressId
    ) {
      return ConnectionType.SAME_DESTINATION;
    }
    if (parcel1.senderId === parcel2.senderId) {
      return ConnectionType.SAME_SENDER;
    }
    return ConnectionType.BULK_SHIPMENT;
  }

  private async createConnection(
    parcelId1: number,
    parcelId2: number,
    connectionType: ConnectionType,
  ) {
    // Create bidirectional connections
    await this.prismaService.connectedParcel.createMany({
      data: [
        { parcelId: parcelId1, connectedToId: parcelId2, connectionType },
        { parcelId: parcelId2, connectedToId: parcelId1, connectionType },
      ],
      skipDuplicates: true,
    });
  }

  private buildParcelGroups(connections: any[]) {
    // Simple clustering algorithm - could be improved
    const groups: any[] = [];
    const processed = new Set();

    connections.forEach((connection) => {
      if (!processed.has(connection.parcelId)) {
        const group = this.findConnectedGroup(
          connection.parcelId,
          connections,
          new Set(),
        );
        if (group.size > 1) {
          groups.push({
            id: `group_${groups.length + 1}`,
            parcels: Array.from(group),
            size: group.size,
            connectionTypes: [
              ...new Set(
                connections
                  .filter(
                    (c) => group.has(c.parcelId) || group.has(c.connectedToId),
                  )
                  .map((c) => c.connectionType),
              ),
            ],
          });
        }
        group.forEach((id) => processed.add(id));
      }
    });

    return groups;
  }

  private findConnectedGroup(
    parcelId: number,
    connections: any[],
    visited: Set<number>,
  ): Set<number> {
    visited.add(parcelId);
    const group = new Set([parcelId]);

    connections
      .filter(
        (c) =>
          (c.parcelId === parcelId || c.connectedToId === parcelId) &&
          !visited.has(c.parcelId === parcelId ? c.connectedToId : c.parcelId),
      )
      .forEach((connection) => {
        const nextId =
          connection.parcelId === parcelId
            ? connection.connectedToId
            : connection.parcelId;
        const subGroup = this.findConnectedGroup(nextId, connections, visited);
        subGroup.forEach((id) => group.add(id));
      });

    return group;
  }
}
