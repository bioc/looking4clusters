run_umap <- function(object){
    if(requireNamespace("uwot", quietly=TRUE)){
        data <- object$data
        n_neighbors <- 15
        if(n_neighbors>(nrow(data)/3)){
            n_neighbors <- floor(nrow(data)/3)
        }
        if(n_neighbors < 2){
            n_neighbors <- 2
        }
        UMAPcomponents <- uwot::umap(data, n_neighbors = n_neighbors)
        colnames(UMAPcomponents) <- c("UMAP1","UMAP2")
        object <- addreduction(object,UMAPcomponents,"umap")
    }else{
        warning("Install 'uwot' to get umap dimensionality reduction.")
    }
    return(object)
}
