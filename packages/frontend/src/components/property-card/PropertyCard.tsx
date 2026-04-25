'use client';

import Image from 'next/image';
import { Building2, Bed, Bath, MapPin, Star, MoreVertical } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatPrice, propertyStatusColor, propertyStatusLabel, propertyTypeLabel } from '@/lib/format';
import type { Property } from '@/lib/api';

interface PropertyAction {
  label: string;
  onClick: () => void;
  destructive?: boolean;
}

interface PropertyCardProps {
  property: Property;
  showOwnerData?: boolean;
  actions?: PropertyAction[];
}

export function PropertyCard({ property, actions }: PropertyCardProps) {
  const photo = property.photos?.[0];

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-md transition-shadow">
      {/* Imagen */}
      <div className="relative h-48 bg-slate-100">
        {photo ? (
          <Image src={photo} alt={property.title} fill className="object-cover" unoptimized />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300">
            <Building2 className="h-12 w-12" />
            <span className="text-xs mt-1">Sin fotos</span>
          </div>
        )}

        {/* Badges sobre imagen */}
        <div className="absolute top-2 left-2 flex gap-1.5 flex-wrap">
          <Badge className={cn('text-xs font-medium border-0', propertyStatusColor(property.status))}>
            {propertyStatusLabel(property.status)}
          </Badge>
          {property.featured && (
            <Badge className="text-xs bg-amber-100 text-amber-800 border-0">
              <Star className="h-3 w-3 mr-1 fill-amber-500 text-amber-500" />
              Destacado
            </Badge>
          )}
        </div>

        {/* Menú de acciones */}
        {actions && actions.length > 0 && (
          <div className="absolute top-2 right-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="secondary" className="h-7 w-7 bg-white/90 hover:bg-white">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {actions.map((action) => (
                  <DropdownMenuItem
                    key={action.label}
                    onClick={action.onClick}
                    className={action.destructive ? 'text-red-600 focus:text-red-600' : ''}
                  >
                    {action.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      {/* Contenido */}
      <div className="p-4 space-y-2">
        <div>
          <p className="text-xs text-slate-400 uppercase tracking-wide font-medium">
            {propertyTypeLabel(property.type)} · {property.operation === 'VENTA' ? 'Venta' : property.operation === 'ARRIENDO' ? 'Arriendo' : 'Venta o Arriendo'}
          </p>
          <h3 className="font-semibold text-slate-800 leading-tight line-clamp-2 mt-0.5">
            {property.title}
          </h3>
        </div>

        <div className="flex items-center gap-1 text-sm text-slate-500">
          <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
          <span className="truncate">{property.city}{property.neighborhood ? `, ${property.neighborhood}` : ''}</span>
        </div>

        <p className="text-lg font-bold text-slate-900">
          {formatPrice(property.price, property.priceCurrency)}
        </p>

        {(property.bedrooms || property.bathrooms) && (
          <div className="flex gap-3 text-sm text-slate-500 pt-1 border-t border-slate-100">
            {property.bedrooms != null && (
              <span className="flex items-center gap-1">
                <Bed className="h-3.5 w-3.5" />
                {property.bedrooms} hab.
              </span>
            )}
            {property.bathrooms != null && (
              <span className="flex items-center gap-1">
                <Bath className="h-3.5 w-3.5" />
                {property.bathrooms} baños
              </span>
            )}
            {property.areaTotalM2 != null && (
              <span className="text-slate-400">{property.areaTotalM2} m²</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
