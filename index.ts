export interface UnitOfWork {
  beginWork(): void
  commitWork(): Promise<void>
}

export interface UnitOfWorkObject<Tx> {
  createByTx(tx: Tx): Promise<void>
  updateByTx(tx: Tx): Promise<void>
  deleteByTx(tx: Tx): Promise<void>
}

export abstract class UnitOfWorkTemplate<Tx> implements UnitOfWork {
  private creates: UnitOfWorkObject<Tx>[] = []
  private updates: UnitOfWorkObject<Tx>[] = []
  private deletes: UnitOfWorkObject<Tx>[] = []
  private isActive: boolean = false

  /* abstract */

  /**
   * begin begins a new transaction
   */
  protected abstract begin(): Promise<Tx> 

  /**
   * commit commits a transaction
   */
  protected abstract commit(tx: Tx): Promise<void> 

  /** 
   * rollback rollbacks a transaction
   */
  protected abstract rollback(tx: Tx): Promise<void>

  /** 
   * release releases a transaction (should be overridden if needed)
   */
  protected release(tx: Tx): Promise<void> {
    return Promise.resolve()
  }

  /** 
   * beginWork begins a transaction in this unit of work
   */
  public beginWork(): void {
    this.isActive = true
  }

  /** 
   * commitWork commits all actions in this unit of work
   */
  public commitWork(): Promise<void> {
    return this.commitChanges()
  }

  /* protected */

  /** 
   * markCreate caches object which is going to be created
   */
  protected markCreate(uowObj: UnitOfWorkObject<Tx>): Promise<void> {
    return this.mark(() => this.creates.push(uowObj))
  }

  /** 
   * markUpdate caches object which is going to be updated
   */
  protected markUpdate(uowObj: UnitOfWorkObject<Tx>): Promise<void> {
    return this.mark(() => this.updates.push(uowObj))
  }

  /** 
   * markDelete caches object which is going to be deleted
   */
  protected markDelete(uowObj: UnitOfWorkObject<Tx>): Promise<void> {
    return this.mark(() => this.deletes.push(uowObj))
  }

  /* private */

  private async mark(mark: () => void): Promise<void> {
    mark()

    if (!this.isActive) {
      await this.commitChanges()
    }
  }

  private async commitChanges(): Promise<void> {
    const tx = await this.begin()

    try {
      // for the possibility of multiple db manipulations in each action,
      // actions should wait for others to finish before continuing
      await this.commitCreates(tx)
      await this.commitUpdates(tx)
      await this.commitDeletes(tx)
      await this.commit(tx)
    } catch (e) {
      await this.rollback(tx)
    } finally {
      await this.release(tx)
      this.dispose()
    }
  }

  private async commitCreates(tx: Tx): Promise<void> {
    await Promise.all(this.creates.map(m => m.createByTx(tx)))
  }

  private async commitUpdates(tx: Tx): Promise<void> {
    await Promise.all(this.updates.map(m => m.updateByTx(tx)))
  }

  private async commitDeletes(tx: Tx): Promise<void> {
    await Promise.all(this.deletes.map(m => m.deleteByTx(tx)))
  }

  private dispose() {
    this.creates = []
    this.updates = []
    this.deletes = []
    this.isActive = false
  }
}