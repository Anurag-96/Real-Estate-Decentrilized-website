
import { Component, ChangeDetectionStrategy, signal, computed, effect, afterNextRender, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GeminiService } from './gemini.service';

interface PriceHistory {
  date: string;
  price: number;
}

interface Review {
  author: string;
  rating: number; // out of 5
  comment: string;
}

interface Property {
  id: number;
  name: string;
  price: number;
  beds: number;
  baths: number;
  sqft: number;
  imageUrl: string;
  imageLoading: boolean;
  type: string;
  yearBuilt: number;
  pricePerSqft: number;
  status: 'For Sale' | 'New Listing';
  tags: string[];
  priceHistory: PriceHistory[];
  reviews: Review[];
}

interface TransactionLog {
  timestamp: string;
  message: string;
  isLink?: boolean;
  txHash?: string;
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements OnInit {
  private geminiService = inject(GeminiService);

  private readonly initialListingsData = [
    { id: 1, name: 'Urban Loft, Downtown', price: 450000, beds: 2, baths: 2, sqft: 1200, type: 'Loft', yearBuilt: 2018, pricePerSqft: 375, status: 'New Listing', tags: ['Exposed Brick', 'Open Floor Plan', 'Central Location'], priceHistory: [{date: '2019-03-15', price: 380000}], reviews: [{author: 'Alex D.', rating: 5, comment: 'Incredible space and location!'}, {author: 'Samantha B.', rating: 4, comment: 'Great loft, but can be a bit noisy on weekends.'}]},
    { id: 2, name: 'Suburban Villa, Green Hills', price: 1200000, beds: 4, baths: 3, sqft: 3500, type: 'Villa', yearBuilt: 2022, pricePerSqft: 343, status: 'For Sale', tags: ['Swimming Pool', 'Large Backyard', 'Gated Community', 'Private Garage'], priceHistory: [], reviews: [{author: 'Brenda K.', rating: 5, comment: 'Our dream home. The pool is amazing.'}, {author: 'Tom H.', rating: 4, comment: 'Fantastic property. The garden needs a bit of work, but otherwise perfect.'}]},
    { id: 3, name: 'Beachfront Condo', price: 890000, beds: 3, baths: 2, sqft: 2100, type: 'Condo', yearBuilt: 2015, pricePerSqft: 424, status: 'For Sale', tags: ['Ocean View', 'Private Balcony', 'Swimming Pool'], priceHistory: [{date: '2016-01-20', price: 750000}], reviews: [{author: 'Carlos M.', rating: 4, comment: 'Great views, though the HOA fees are a bit high.'}, {author: 'Jessica L.', rating: 5, comment: 'Waking up to the ocean sound is priceless. Highly recommend.'}]},
    { id: 4, name: 'Modern Penthouse', price: 2100000, beds: 4, baths: 4, sqft: 4200, type: 'Penthouse', yearBuilt: 2024, pricePerSqft: 500, status: 'New Listing', tags: ['Rooftop Deck', 'Floor-to-ceiling windows', 'Ocean View', 'Private Garage'], priceHistory: [], reviews: [{author: 'Michael P.', rating: 5, comment: 'The epitome of luxury. The views are breathtaking.'}, {author: 'Sarah J.', rating: 4, comment: 'Incredible apartment. The elevator can be slow during peak hours.'}]},
    { id: 5, name: 'City Apartment', price: 320000, beds: 1, baths: 1, sqft: 850, type: 'Apartment', yearBuilt: 2010, pricePerSqft: 376, status: 'For Sale', tags: ['Recently Renovated', 'Central Location'], priceHistory: [{date: '2011-05-30', price: 210000}], reviews: [{author: 'Dana F.', rating: 4, comment: 'Perfect for a single person working downtown.'}]},
    { id: 6, name: 'Executive Townhouse', price: 975000, beds: 3, baths: 3, sqft: 2800, type: 'Townhouse', yearBuilt: 2019, pricePerSqft: 348, status: 'For Sale', tags: ['Private Garage', 'Modern Kitchen', 'Gated Community', 'Rooftop Deck'], priceHistory: [{date: '2020-02-10', price: 850000}], reviews: [{author: 'Frank G.', rating: 5, comment: 'Spacious and very well built.'}, {author: 'Emily R.', rating: 3, comment: 'Nice place, but the community rules are very strict.'}]},
  ];

  listings = signal<Property[]>(
    this.initialListingsData.map(p => ({
        ...p,
        imageUrl: '',
        imageLoading: true
    }))
  );

  // Page state
  viewingProperty = signal<Property | null>(null);
  isTransactionModalOpen = signal(false);

  // Currency state
  activeCurrency = signal<'USD' | 'INR' | 'KWD' | 'RUB'>('USD');
  conversionRates = {
    USD: 1,
    INR: 83.5,
    KWD: 0.31,
    RUB: 91.2
  };

  // Transaction simulator state
  selectedPropertyId = signal<number>(1);
  selectedPropertyForTransaction = computed(() => {
    // The non-null assertion is safe because we know a property with the selected ID will exist in our dataset.
    return this.listings().find(p => p.id === this.selectedPropertyId())!;
  });
  isWalletConnected = signal(false);
  isSimulating = signal(false);
  transactionLogs = signal<TransactionLog[]>([]);
  transactionHash = signal<string | null>(null);
  isCopied = signal(false);
  
  // Filtering state
  activeFilterTag = signal<string | null>(null);
  filteredListings = computed(() => {
    const tag = this.activeFilterTag();
    if (!tag) {
      return this.listings();
    }
    return this.listings().filter(p => p.tags.includes(tag));
  });

  // Analytics Data
  analyticsData = {
    sold: 127,
    inProcess: 42,
  };

  chartData = computed(() => {
    const { sold, inProcess } = this.analyticsData;
    const total = sold + inProcess;
    if (total === 0) {
      return {
        total: 0,
        soldPercent: 0,
        inProcessPercent: 0,
      };
    }
    return {
      total,
      soldPercent: (sold / total) * 100,
      inProcessPercent: (inProcess / total) * 100,
    };
  });
  
  readonly circumference = 2 * Math.PI * 54; // r=54 for viewBox 120

  soldDashoffset = computed(() => {
    return this.circumference * (1 - this.chartData().soldPercent / 100);
  });
  
  inProcessDashoffset = computed(() => {
    const totalPercent = this.chartData().soldPercent + this.chartData().inProcessPercent;
    return this.circumference * (1 - totalPercent / 100);
  });

  transactionDetails = computed(() => {
    const property = this.selectedPropertyForTransaction();
    if (!property) {
        return { to: 'N/A', value: '0', gas: '0' };
    }
    
    const MOCK_ETH_PRICE_USD = 3500;
    const transactionValueUSD = property.price * 0.0001; 
    const ethValue = transactionValueUSD / MOCK_ETH_PRICE_USD;
    const gasFee = 21000 + Math.floor(property.price / 100000);
    const contractAddress = `0x${(property.id * 1337).toString(16).padStart(4, '0')}... (Property ${property.id} Contract)`;

    return {
        to: contractAddress,
        value: `${ethValue.toFixed(4)} Sepolia ETH`,
        gas: `${gasFee.toLocaleString()}`
    };
  });

  constructor() {
    effect(() => {
      if (this.activeFilterTag()) {
        afterNextRender(() => {
          this.scrollTo('listings');
        });
      }
    });
  }

  ngOnInit() {
    this.loadImagesSequentially();
  }

  async loadImagesSequentially() {
    // Increased delay to 5 seconds to stay within the free tier RPM limit (15 RPM -> 1 req/4s)
    const delay = (ms: number) => new Promise(res => setTimeout(res, ms));
    const listingsToProcess = this.listings();

    for (const property of listingsToProcess) {
      const prompt = `a ${property.name}, which is a ${property.type} featuring ${property.tags.join(', ')}.`;
      
      const imageUrl = await this.geminiService.generateImage(prompt);
      
      this.listings.update(currentListings =>
        currentListings.map(p =>
          p.id === property.id ? { ...p, imageUrl, imageLoading: false } : p
        )
      );
      
      // Wait for 5 seconds before the next request to respect API rate limits.
      await delay(5000); 
    }
  }

  setCurrency(currency: 'USD' | 'INR' | 'KWD' | 'RUB') {
    this.activeCurrency.set(currency);
  }

  getFormattedPrice(price: number): string {
    const currency = this.activeCurrency();
    const rate = this.conversionRates[currency];
    const convertedPrice = price * rate;

    try {
        switch (currency) {
            case 'USD':
                return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(convertedPrice);
            case 'INR':
                return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(convertedPrice);
            case 'KWD':
                return new Intl.NumberFormat('ar-KW', { style: 'currency', currency: 'KWD', minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(convertedPrice);
            case 'RUB':
                const formatted = new Intl.NumberFormat('ru-RU', { style: 'decimal', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(convertedPrice);
                return `${formatted} ₽`;
        }
    } catch (e) {
        return `${currency} ${convertedPrice.toLocaleString()}`;
    }
  }

  setFilterTag(tag: string) {
    if (this.activeFilterTag() === tag) {
      this.activeFilterTag.set(null);
    } else {
      this.activeFilterTag.set(tag);
    }
  }

  clearFilter() {
    this.activeFilterTag.set(null);
  }

  scrollTo(elementId: string): void {
    const element = document.getElementById(elementId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  viewPropertyDetails(property: Property) {
    this.viewingProperty.set(property);
    this.scrollTo('property-details');
  }

  closePropertyDetails() {
    this.viewingProperty.set(null);
    this.scrollTo('listings');
  }

  initiatePurchase(property: Property) {
    this.selectedPropertyId.set(property.id);
    this.openTransactionModal();
  }
  
  openTransactionModal() {
    this.isTransactionModalOpen.set(true);
  }

  closeTransactionModal() {
    this.isTransactionModalOpen.set(false);
    this.isWalletConnected.set(false);
    this.isSimulating.set(false);
    this.transactionLogs.set([]);
    this.transactionHash.set(null);
  }

  connectWallet() {
    this.isWalletConnected.set(true);
  }

  simulateTransaction() {
    if (this.isSimulating() || !this.isWalletConnected()) return;

    this.isSimulating.set(true);
    this.transactionLogs.set([]);
    this.transactionHash.set(null);

    const addLog = (message: string, isLink: boolean = false, txHash?: string) => {
        const timestamp = new Date().toLocaleTimeString();
        this.transactionLogs.update(logs => [...logs, { timestamp, message, isLink, txHash }]);
    };
    
    addLog('Pending...');

    setTimeout(() => {
      const fakeHash = '0x' + Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('');
      this.transactionHash.set(fakeHash);
      addLog(`Confirmed! Tx Hash: ${this.truncateHash(fakeHash)}`, false, fakeHash);

      setTimeout(() => {
        addLog('View on Sepolia Explorer', true);
        this.isSimulating.set(false);
      }, 500);

    }, 2000);
  }

  truncateHash(hash: string | null): string {
    if (!hash) return '';
    return `${hash.substring(0, 6)}...${hash.substring(hash.length - 4)}`;
  }
  
  copyToClipboard(text: string | null) {
      if (!text) return;
      navigator.clipboard.writeText(text).then(() => {
          this.isCopied.set(true);
          setTimeout(() => this.isCopied.set(false), 2000);
      });
  }

  getStarArray(rating: number): any[] {
    return Array(Math.round(rating)).fill(0);
  }
  
  getEmptyStarArray(rating: number): any[] {
    return Array(5 - Math.round(rating)).fill(0);
  }
}
