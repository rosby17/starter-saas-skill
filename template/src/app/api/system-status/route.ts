import { NextResponse } from 'next/server'
import { isProviderDegraded } from '@/lib/monitoring/provider-status'
import { readServiceOutages } from '@/lib/monitoring/service-outages'
import { SERVICES } from '@/lib/engines/catalog'
import { unavailableModels } from '@/lib/engines/router'

// Public et minimal, aucune donnée client ni nom de fournisseur :
//  - providerDegraded : services ralentis (plusieurs clients en échec ces dernières minutes) ;
//  - closedServices : services en pause (sonde des moteurs ou admin), avec leur nom à l'écran ;
//  - unavailableModels : modèles sans moteur disponible, à griser dans l'espace client.
export async function GET() {
  const [providerDegraded, outages, models] = await Promise.all([
    isProviderDegraded(),
    readServiceOutages(),
    unavailableModels().catch(() => [] as string[]),
  ])
  const closedServices = SERVICES.filter((service) => outages[service.id]).map((service) => ({ id: service.id, label: service.label }))
  return NextResponse.json({ providerDegraded, closedServices, unavailableModels: models }, { headers: { 'Cache-Control': 'no-store' } })
}
