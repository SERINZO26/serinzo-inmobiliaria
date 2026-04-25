import Link from 'next/link';
import { Bed, Bath, Maximize2, MapPin } from 'lucide-react';
import { type Property } from '@/lib/api';
import { formatPrice, formatArea, propertyOperationLabel } from '@/lib/format';

interface Props {
  property: Property;
}

export function PublicPropertyCard({ property }: Props) {
  const mainPhoto = property.photos?.[0];
  const opLabel = propertyOperationLabel(property.operation);
  const opColor =
    property.operation === 'VENTA'
      ? 'bg-blue-500'
      : property.operation === 'ARRIENDO'
      ? 'bg-green-500'
      : 'bg-purple-500';

  return (
    <Link
      href={`/inmuebles/${property.slug}`}
      className="group bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-sm hover:shadow-lg transition-all duration-300 flex flex-col"
    >
      {/* Foto */}
      <div className="relative overflow-hidden aspect-[4/3] bg-slate-200 flex-shrink-0">
        {mainPhoto ? (
          <img
            src={mainPhoto}
            alt={property.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-slate-100">
            <svg className="h-12 w-12 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M3 9.75L12 3l9 6.75V21H3V9.75z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 21V12h6v9" />
            </svg>
          </div>
        )}

        {/* Badges superiores */}
        <div className="absolute top-3 left-3 right-3 flex items-start justify-between">
          <span className={`${opColor} text-white text-xs font-semibold px-2.5 py-1 rounded-full`}>
            {opLabel}
          </span>
          {property.featured && (
            <span className="bg-amber-400 text-amber-900 text-xs font-semibold px-2.5 py-1 rounded-full">
              ⭐ Destacado
            </span>
          )}
        </div>
      </div>

      {/* Contenido */}
      <div className="p-4 flex flex-col flex-1">
        {/* Precio */}
        <p className="text-xl font-bold text-slate-900">
          {formatPrice(property.price, property.priceCurrency)}
          {property.priceNegotiable && (
            <span className="text-xs font-normal text-slate-400 ml-1">Negociable</span>
          )}
        </p>

        {/* Título */}
        <h3 className="text-sm font-medium text-slate-700 mt-1 line-clamp-2 flex-1">
          {property.title}
        </h3>

        {/* Ubicación */}
        <div className="flex items-center gap-1 mt-2 text-xs text-slate-400">
          <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
          <span className="truncate">
            {[property.neighborhood, property.city].filter(Boolean).join(', ')}
          </span>
        </div>

        {/* Características */}
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-100 text-xs text-slate-500">
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
            <span className="flex items-center gap-1">
              <Maximize2 className="h-3.5 w-3.5" />
              {formatArea(property.areaTotalM2)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
