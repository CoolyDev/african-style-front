import { DecimalPipe } from '@angular/common';
import {HttpClient, HttpEvent, HttpRequest} from '@angular/common/http';
import { Injectable, PipeTransform } from '@angular/core';
import { SortDirection } from '@modules/products/directives';
import {Product, Video} from '@modules/products/models';
import { BehaviorSubject, Observable, of, Subject } from 'rxjs';
import { debounceTime, delay, switchMap, tap } from 'rxjs/operators';

interface SearchResult {
    product: Product[];
    total: number;
}


interface State {
    page: number;
    pageSize: number;
    searchTerm: string;
    sortColumn: string;
    sortDirection: SortDirection;
}

function compare(v1: number | string, v2: number | string) {
    return v1 < v2 ? -1 : v1 > v2 ? 1 : 0;
}

function sort(product: any[], column: string, direction: string): Product[] {
    if (direction === '') {
        return product;
    } else {
        return [...product].sort((a, b) => {
            const res = compare(a[column], b[column]);
            return direction === 'asc' ? res : -res;
        });
    }
}

function matches(product: Product, term: string, pipe: PipeTransform) {
    return (
        product?.categorie?.toLowerCase().includes(term?.toLowerCase()) ||
        pipe.transform(product.vues).includes(term) ||
        pipe.transform(product.note).includes(term)
    );
}

@Injectable({ providedIn: 'root' })
export class ProductService {
    private _loading$ = new BehaviorSubject<boolean>(true);
    private _search$ = new Subject<void>();
    private _product$ = new BehaviorSubject<Product[]>([]);
    private _video$ = new BehaviorSubject<Video[]>([]);

    private _total$ = new BehaviorSubject<number>(0);
    private baseUrl = 'https://myafricanstyle.herokuapp.com';
    private _state: State = {
        page: 1,
        pageSize: 4,
        searchTerm: '',
        sortColumn: '',
        sortDirection: '',
    };

    constructor(private pipe: DecimalPipe,private http: HttpClient) {
       this.getProduct()
    }

    get product() {
        return this._product$.asObservable();
    }
    get video() {
        return this._video$.asObservable();
    }
    get total$() {
        return this._total$.asObservable();
    }
    get loading$() {
        return this._loading$.asObservable();
    }
    get page() {
        return this._state.page;
    }
    set page(page: number) {
        this._set({ page });
    }
    get pageSize() {
        return this._state.pageSize;
    }
    set pageSize(pageSize: number) {
        this._set({ pageSize });
    }
    get searchTerm() {
        return this._state.searchTerm;
    }
    set searchTerm(searchTerm: string) {
        this._set({ searchTerm });
    }
    set sortColumn(sortColumn: string) {
        this._set({ sortColumn });
    }
    set sortDirection(sortDirection: SortDirection) {
        this._set({ sortDirection });
    }
    private _set(patch: Partial<State>) {
        Object.assign(this._state, patch);
        this._search$.next();
    }
    private _search(data: any[]): Observable<SearchResult> {
        const { sortColumn, sortDirection, pageSize, page, searchTerm } = this._state;

        // 1. sort
        let product = sort(data, sortColumn, sortDirection);

        // 2. filter
        product = product.filter(mod => matches(mod, searchTerm, this.pipe));
        const total = product.length;

        // 3. paginate
        product = product.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize);
        return of({ product, total });
    }

    upload(file: File):Observable<HttpEvent<any>>{
        const formData: FormData = new FormData();
        formData.append('file', file);
        const req = new HttpRequest('POST', `${this.baseUrl}/upload`, formData, {
            reportProgress: true,
            responseType: 'json'
        });
        return this.http.request(req);
    }

    getFiles(): Observable<any> {
        return this.http.get(`${this.baseUrl}/files`);
    }

    createProduct(product: any) {
        return this.http.post(`${this.baseUrl}/product`, product, {responseType: 'json'})
    }
    getProduct(){
        return this.http.get(`${this.baseUrl}/product`, { responseType: 'json' }).subscribe(
            (product:any)=>{
                this._product$.next(product);
                this._total$.next(product.length)
                this._search$
                    .pipe(
                        tap(() => this._loading$.next(true)),
                        debounceTime(120),
                        switchMap(() => this._search(product)),
                        delay(120),
                        tap(() => this._loading$.next(false))
                    )
                    .subscribe(result => {
                        this._product$.next(result.product);
                        this._total$.next(result.total);
                    });

                this._search$.next();
            }
        );
    }

    deleteProduct(id: string | undefined){
        return this.http.delete(`${this.baseUrl}/product/`+id, { responseType: 'json' }).subscribe(
            ()=> this.getProduct()
        );
    }
    getVideo()      {
        return this.http.get(`${this.baseUrl}/video`, { responseType: 'json' }).subscribe(
            (video:any)=>{
                this._video$.next(video);
                this._total$.next(video.length)
                this._search$
                    .pipe(
                        tap(() => this._loading$.next(true)),
                        debounceTime(120),
                        switchMap(() => this._search(video)),
                        delay(120),
                        tap(() => this._loading$.next(false))
                    )
                    .subscribe(result => {
                        // this._product$.next(result.video);
                        this._total$.next(result.total);
                    });

                this._search$.next();
            }
        );
    }
    createVideo(product: any) {
        return this.http.post(`${this.baseUrl}/video`, product, {responseType: 'json'})
    }
    deleteVideo(id: string | undefined){
        return this.http.delete(`${this.baseUrl}/video/`+id, { responseType: 'json' }).subscribe(
            ()=> this.getVideo()
        );
    }
}
