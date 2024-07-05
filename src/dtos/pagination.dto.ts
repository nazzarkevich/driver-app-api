export interface Pagination<T> {
  items: T[];
  isFirstPage: boolean;
  isLastPage: boolean;
  currentPage: number;
  previousPage: number | null;
  nextPage: number | null;
  pageCount: number;
  totalCount: number;
}

/* 
 TODO: Pagination parameters to pass
    page: 1
    size: 15 - DEFAULT
    orderBy: registration / size / price
    dir: 1 asc / 2 desc
*/
