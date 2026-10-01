export interface AddressSuggestion {
  id: string;
  label: string;
  description?: string;
}

export interface AddressSearchResponse {
  results: AddressSuggestion[];
}
