"use client";

import { useState, useEffect, useRef, lazy, Suspense } from "react";
import { haversineKm } from "@/lib/geo";

const Map = lazy(() => import("@/components/Map"));

interface Category {
  id: string;
  name: string;
  kind: string;
  count: number;
}

interface Organization {
  chamberOfCommerceId: string;
  name: string;
  street: string;
  houseNumber: string;
  houseNumberPostfix?: string;
  postalCode: string;
  city: string;
  telephone?: string;
  gpsLatitude: number;
  gpsLongitude: number;
}

interface Qualification {
  qualificationType: string;
  qualificationTypeId: string;
  status: string;
  qualificationKind: string;
  issuedBy?: string;
  startDate?: string;
  endDate?: string;
}

interface OrgQualification {
  organization: Organization;
  qualification: Qualification;
  distanceKm?: number;
}

interface GeocodeResult {
  label: string;
  lat: number;
  lng: number;
}

function formatDate(dateStr?: string): string {
  if (!dateStr || dateStr.length !== 8) return "-";
  return `${dateStr.slice(6, 8)}-${dateStr.slice(4, 6)}-${dateStr.slice(0, 4)}`;
}

const RADIUS_OPTIONS = [5, 10, 25, 50, 100];

export default function Home() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [organizations, setOrganizations] = useState<OrgQualification[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingOrgs, setLoadingOrgs] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "Actief" | "Inactief">("all");
  const [view, setView] = useState<"table" | "map">("table");

  // Regio zoeken
  const [locationQuery, setLocationQuery] = useState("");
  const [locationSuggestions, setLocationSuggestions] = useState<GeocodeResult[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<GeocodeResult | null>(null);
  const [radius, setRadius] = useState<number>(25);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch("/api/categories")
      .then((res) => res.json())
      .then((data) => {
        setCategories(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedCategory) {
      setOrganizations([]);
      return;
    }
    setLoadingOrgs(true);
    fetch(`/api/organizations?category=${encodeURIComponent(selectedCategory)}`)
      .then((res) => res.json())
      .then((data) => {
        setOrganizations(data.results);
        setLoadingOrgs(false);
      })
      .catch(() => setLoadingOrgs(false));
  }, [selectedCategory]);

  // Debounce geocode suggestions
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (locationQuery.length < 2) {
      setLocationSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(() => {
      setLoadingSuggestions(true);
      fetch(`/api/geocode?q=${encodeURIComponent(locationQuery)}`)
        .then((res) => res.json())
        .then((data) => {
          setLocationSuggestions(data);
          setLoadingSuggestions(false);
        })
        .catch(() => setLoadingSuggestions(false));
    }, 300);
  }, [locationQuery]);

  // Close suggestions on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
        setLocationSuggestions([]);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Compute distances
  const orgsWithDistance: OrgQualification[] = organizations.map((item) => {
    if (!selectedLocation) return item;
    const distanceKm = haversineKm(
      { lat: selectedLocation.lat, lng: selectedLocation.lng },
      { lat: item.organization.gpsLatitude, lng: item.organization.gpsLongitude }
    );
    return { ...item, distanceKm };
  });

  const filtered = orgsWithDistance
    .filter((item) => {
      const matchesSearch =
        !search ||
        item.organization.name.toLowerCase().includes(search.toLowerCase()) ||
        item.organization.city.toLowerCase().includes(search.toLowerCase()) ||
        item.organization.chamberOfCommerceId.includes(search);
      const matchesStatus =
        statusFilter === "all" || item.qualification.status === statusFilter;
      const matchesRadius =
        !selectedLocation ||
        (item.distanceKm !== undefined && item.distanceKm <= radius);
      return matchesSearch && matchesStatus && matchesRadius;
    })
    .sort((a, b) => {
      if (selectedLocation && a.distanceKm !== undefined && b.distanceKm !== undefined) {
        return a.distanceKm - b.distanceKm;
      }
      return 0;
    });

  const activeCount = organizations.filter((o) => o.qualification.status === "Actief").length;
  const inactiveCount = organizations.length - activeCount;

  const mapMarkers = filtered.map((item) => ({
    name: item.organization.name,
    street: item.organization.street,
    houseNumber: item.organization.houseNumber,
    houseNumberPostfix: item.organization.houseNumberPostfix,
    postalCode: item.organization.postalCode,
    city: item.organization.city,
    telephone: item.organization.telephone,
    chamberOfCommerceId: item.organization.chamberOfCommerceId,
    lat: item.organization.gpsLatitude,
    lng: item.organization.gpsLongitude,
    status: item.qualification.status,
    qualificationType: item.qualification.qualificationType,
    endDate: item.qualification.endDate,
    distanceKm: item.distanceKm,
  }));

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500 text-lg">Categorieën laden...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <h1 className="text-2xl font-bold text-gray-900">Centraal Register Techniek</h1>
        <p className="text-sm text-gray-500 mt-1">
          Zoek erkende en gecertificeerde bedrijven per categorie
        </p>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-4">
        {/* Categorie + locatie filters */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Categorie */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Categorie
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value);
                  setSearch("");
                  setStatusFilter("all");
                }}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              >
                <option value="">-- Kies een categorie --</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name} ({cat.kind}) — {cat.count} registratie{cat.count !== 1 ? "s" : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Locatie */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Locatie (optioneel)
              </label>
              <div className="relative" ref={suggestionsRef}>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      placeholder="Postcode of plaatsnaam..."
                      value={locationQuery}
                      onChange={(e) => {
                        setLocationQuery(e.target.value);
                        if (selectedLocation) setSelectedLocation(null);
                      }}
                      className={`w-full rounded-md border px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:ring-1 ${
                        selectedLocation
                          ? "border-blue-500 bg-blue-50 focus:border-blue-500 focus:ring-blue-500"
                          : "border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                      }`}
                    />
                    {loadingSuggestions && (
                      <div className="absolute right-3 top-2.5 text-gray-400 text-xs">...</div>
                    )}
                  </div>
                  <select
                    value={radius}
                    onChange={(e) => setRadius(Number(e.target.value))}
                    disabled={!selectedLocation}
                    className="rounded-md border border-gray-300 bg-white px-2 py-2 text-sm text-gray-700 disabled:opacity-40"
                  >
                    {RADIUS_OPTIONS.map((r) => (
                      <option key={r} value={r}>{r} km</option>
                    ))}
                  </select>
                  {selectedLocation && (
                    <button
                      onClick={() => {
                        setSelectedLocation(null);
                        setLocationQuery("");
                        setLocationSuggestions([]);
                      }}
                      className="text-gray-400 hover:text-gray-600 px-1"
                      title="Locatie wissen"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {locationSuggestions.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg">
                    {locationSuggestions.map((s, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          setSelectedLocation(s);
                          setLocationQuery(s.label);
                          setLocationSuggestions([]);
                        }}
                        className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 first:rounded-t-md last:rounded-b-md"
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {selectedLocation && (
                <p className="text-xs text-blue-600 mt-1">
                  Toont bedrijven binnen {radius} km van {selectedLocation.label}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Resultaten */}
        {selectedCategory && (
          <>
            {/* Stats + weergave toggle + filters */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                {/* Stats */}
                <div className="flex gap-4 text-sm">
                  <span className="text-gray-600">
                    Totaal: <span className="font-semibold">{organizations.length}</span>
                  </span>
                  <span className="text-green-600">
                    Actief: <span className="font-semibold">{activeCount}</span>
                  </span>
                  <span className="text-red-600">
                    Inactief: <span className="font-semibold">{inactiveCount}</span>
                  </span>
                  {selectedLocation && (
                    <span className="text-blue-600">
                      Binnen {radius} km: <span className="font-semibold">{filtered.length}</span>
                    </span>
                  )}
                </div>

                <div className="flex-1" />

                {/* Weergave toggle */}
                <div className="flex rounded-md border border-gray-300 overflow-hidden text-sm">
                  <button
                    onClick={() => setView("table")}
                    className={`px-3 py-1.5 flex items-center gap-1.5 ${
                      view === "table"
                        ? "bg-gray-900 text-white"
                        : "bg-white text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M3 10h18M3 14h18M10 6h11M10 18h11M3 6h1M3 18h1" />
                    </svg>
                    Tabel
                  </button>
                  <button
                    onClick={() => setView("map")}
                    className={`px-3 py-1.5 flex items-center gap-1.5 border-l border-gray-300 ${
                      view === "map"
                        ? "bg-gray-900 text-white"
                        : "bg-white text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                    </svg>
                    Kaart
                  </button>
                </div>

                {/* Filters (only table) */}
                {view === "table" && (
                  <>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value as "all" | "Actief" | "Inactief")}
                      className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700"
                    >
                      <option value="all">Alle statussen</option>
                      <option value="Actief">Alleen actief</option>
                      <option value="Inactief">Alleen inactief</option>
                    </select>
                    <input
                      type="text"
                      placeholder="Zoek op naam, plaats of KVK..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-900 placeholder-gray-400 w-full sm:w-64"
                    />
                  </>
                )}
              </div>
            </div>

            {/* Kaart */}
            {view === "map" && (
              <Suspense
                fallback={
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center text-gray-500"
                    style={{ height: 520 }}>
                    Kaart laden...
                  </div>
                }
              >
                {loadingOrgs ? (
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center text-gray-500"
                    style={{ height: 520 }}>
                    Bedrijven laden...
                  </div>
                ) : (
                  <Map
                    markers={mapMarkers}
                    center={selectedLocation ?? undefined}
                    radius={selectedLocation ? radius : undefined}
                  />
                )}
              </Suspense>
            )}

            {/* Tabel */}
            {view === "table" && (
              <>
                {loadingOrgs ? (
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center text-gray-500">
                    Bedrijven laden...
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center text-gray-500">
                    Geen bedrijven gevonden
                    {selectedLocation && ` binnen ${radius} km van ${selectedLocation.label}`}
                    {search && ` voor "${search}"`}.
                  </div>
                ) : (
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bedrijfsnaam</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Adres</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">KVK</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Telefoon</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Geldig t/m</th>
                            {selectedLocation && (
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Afstand</th>
                            )}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {filtered.map((item, i) => (
                            <tr
                              key={`${item.organization.chamberOfCommerceId}-${i}`}
                              className="hover:bg-gray-50"
                            >
                              <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                {item.organization.name}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600">
                                {item.organization.street} {item.organization.houseNumber}
                                {item.organization.houseNumberPostfix?.trim()}
                                <br />
                                <span className="text-gray-400">
                                  {item.organization.postalCode} {item.organization.city}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600 font-mono">
                                {item.organization.chamberOfCommerceId}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600">
                                {item.organization.telephone || "-"}
                              </td>
                              <td className="px-4 py-3">
                                <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                                  item.qualification.status === "Actief"
                                    ? "bg-green-100 text-green-800"
                                    : "bg-red-100 text-red-800"
                                }`}>
                                  {item.qualification.status}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600">
                                {formatDate(item.qualification.endDate)}
                              </td>
                              {selectedLocation && (
                                <td className="px-4 py-3 text-sm text-gray-600">
                                  {item.distanceKm !== undefined
                                    ? item.distanceKm < 1
                                      ? `${Math.round(item.distanceKm * 1000)} m`
                                      : `${item.distanceKm.toFixed(1)} km`
                                    : "-"}
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                <p className="text-xs text-gray-400 mt-2 text-center">
                  {filtered.length} van {organizations.length} resultaten
                  {selectedLocation && ` binnen ${radius} km`}
                  {search && ` · gefilterd op "${search}"`}
                </p>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
